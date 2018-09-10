import _ from 'underscore';
import { betterSetInterval, betterClearInterval } from 'apify-shared/utilities';
import log from 'apify-shared/log';
import { checkParamOrThrow } from 'apify-client/build/utils';
import { getMemoryInfo, isAtHome } from '../utils';
import { ACTOR_EVENT_NAMES } from '../constants';
import events from '../events';

const DEFAULT_OPTIONS = {
    eventLoopSnapshotIntervalSecs: 0.5,
    memorySnapshotIntervalSecs: 1,
    snapshotHistorySecs: 60,
    maxBlockedRatio: 0.1,
    minFreeMemoryRatio: 0.7,
};

/**
 * Creates snapshots of system resources at given intervals.
 * Provides an interface to read captured snapshots.
 *
 * @param options
 */
export default class Snapshotter {
    constructor(options = {}) {
        const {
            eventLoopSnapshotIntervalSecs,
            memorySnapshotIntervalSecs,
            snapshotHistorySecs,
            maxBlockedRatio,
            minFreeMemoryRatio,
            maxMemoryMbytes,
        } = _.defaults(options, DEFAULT_OPTIONS);

        checkParamOrThrow(eventLoopSnapshotIntervalSecs, 'options.eventLoopSnapshotIntervalSecs', 'Number');
        checkParamOrThrow(memorySnapshotIntervalSecs, 'options.memorySnapshotIntervalSecs', 'Number');
        checkParamOrThrow(snapshotHistorySecs, 'options.snapshotHistorySecs', 'Number');
        checkParamOrThrow(maxBlockedRatio, 'options.maxBlockedRatio', 'Number');
        checkParamOrThrow(minFreeMemoryRatio, 'options.minFreeMemoryRatio', 'Number');
        checkParamOrThrow(maxMemoryMbytes, 'options.maxMemoryMbytes', 'Maybe Number');

        this.eventLoopSnapshotIntervalMillis = eventLoopSnapshotIntervalSecs * 1000;
        this.memorySnapshotIntervalMillis = memorySnapshotIntervalSecs * 1000;
        this.snapshotHistoryMillis = snapshotHistorySecs * 1000;
        this.maxBlockedMillis = 1000 * eventLoopSnapshotIntervalSecs * maxBlockedRatio;
        this.minFreeMemoryRatio = minFreeMemoryRatio;
        if (maxMemoryMbytes) this.maxMemoryBytes = maxMemoryMbytes * 1024 * 1024;

        this.cpuSnapshots = [];
        this.eventLoopSnapshots = [];
        this.memorySnapshots = [];
    }

    async start() {
        // Ensure max memory is correctly computed.
        if (!this.maxMemoryBytes) {
            const { totalBytes } = await getMemoryInfo();
            if (isAtHome()) this.maxMemoryBytes = totalBytes;
            else this.maxMemoryBytes = Math.ceil(totalBytes / 4);
        }
        // Add dummy snapshot to compare the first with.
        this.eventLoopSnapshots.push({
            createdAt: new Date(),
            isOverloaded: false,
            exceededMillis: 0,
        });

        // Start snapshotting.
        this.eventLoopInterval = betterSetInterval(this._snapshotEventLoop.bind(this), this.eventLoopSnapshotIntervalMillis);
        this.memoryInterval = betterSetInterval(this._snapshotMemory.bind(this), this.memorySnapshotIntervalMillis);
        if (isAtHome()) events.on(ACTOR_EVENT_NAMES.CPU_INFO, this._snapshotCpu.bind(this));
    }

    async stop() {
        betterClearInterval(this.eventLoopInterval);
        betterClearInterval(this.memoryInterval);
        if (isAtHome()) events.removeListener(ACTOR_EVENT_NAMES.CPU_INFO, this._snapshotCpu);
        // Allow event loop to unwind before stop returns.
        await new Promise(resolve => setImmediate(resolve));
    }

    getMemorySample(sampleDurationMillis) {
        return this._getSample(this.memorySnapshots, sampleDurationMillis);
    }

    getEventLoopSample(sampleDurationMillis) {
        return this._getSample(this.eventLoopSnapshots, sampleDurationMillis);
    }

    getCpuSample(sampleDurationMillis) {
        return this._getSample(this.cpuSnapshots, sampleDurationMillis);
    }

    _getSample(snapshots, sampleDurationMillis) { // eslint-disable-line class-methods-use-this
        if (!sampleDurationMillis) return snapshots;

        const sample = [];
        let idx = snapshots.length;
        if (!idx) return sample;

        const latestTime = snapshots[idx - 1].createdAt;
        while (idx--) {
            const snapshot = snapshots[idx];
            if (latestTime - snapshot.createdAt <= sampleDurationMillis) sample.unshift(snapshot);
            else break;
        }
        return sample;
    }

    async _snapshotMemory(intervalCallback) {
        try {
            const now = new Date();
            const memInfo = await getMemoryInfo();
            const { mainProcessBytes, childProcessesBytes } = memInfo;
            this._pruneSnapshots(this.memorySnapshots, now);

            const usedBytes = mainProcessBytes + childProcessesBytes;
            const snapshot = Object.assign(memInfo, {
                createdAt: now,
                isOverloaded: usedBytes / this.maxMemoryBytes > this.minFreeMemoryRatio,
            });

            this.memorySnapshots.push(snapshot);
        } catch (err) {
            log.exception(err, 'Snapshotter: Memory snapshot failed.');
        } finally {
            intervalCallback();
        }
    }

    _snapshotEventLoop(intervalCallback) {
        try {
            const now = new Date();
            this._pruneSnapshots(this.eventLoopSnapshots, now);
            const { createdAt } = this.eventLoopSnapshots[this.eventLoopSnapshots.length - 1];
            const delta = now - createdAt - this.eventLoopSnapshotIntervalMillis;

            const snapshot = {
                createdAt: now,
                isOverloaded: false,
                exceededMillis: Math.max(delta - this.maxBlockedMillis, 0),
            };

            if (delta > this.maxBlockedMillis) snapshot.isOverloaded = true;
            this.eventLoopSnapshots.push(snapshot);
        } catch (err) {
            log.exception(err, 'Snapshotter: Event Loop snapshot failed.');
        } finally {
            intervalCallback();
        }
    }

    _snapshotCpu(cpuInfoEvent) {
        const createdAt = (new Date(cpuInfoEvent.createdAt));
        this._pruneSnapshots(this.cpuSnapshots, createdAt);
        this.cpuSnapshots.push({
            createdAt,
            isOverloaded: cpuInfoEvent.isCpuOverloaded,
        });
    }

    _pruneSnapshots(snapshots, now) {
        let oldCount = 0;
        for (let i = 0; i < snapshots.length; i++) {
            const { createdAt } = snapshots[i];
            if (now - createdAt > this.snapshotHistoryMillis) oldCount++;
            else break;
        }
        snapshots.splice(0, oldCount);
    }
}
