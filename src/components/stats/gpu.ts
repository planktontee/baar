import { execAsync, Variable } from "astal";
import { Logger } from "src/core/lang/log";
import { wrapIO } from "src/core/matcher/base";
import { EagerPoll } from "../common/variable";
import { Poller } from "./poller";
import { Measured } from "src/core/lang/timer";

export interface GpuStats {
    readonly cpuUsage?: number;
    readonly ramUsage?: number;
    readonly temp?: number;
}

interface RawGPUStas {
    readonly temperatures: number[];
    readonly vRAMUsages: number[];
    readonly cpuUsages: number[];
}

export class GpuPoller implements Poller<GpuStats> {
    private static logger: Logger = Logger.get(GpuPoller);

    public pollerVariable(frequency: number): Variable<GpuStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
    }

    // Todo: use a different strategy 400ms+
    @Measured(GpuPoller.logger.debug)
    public async stats(): Promise<GpuStats> {
        const cmd = "nvidia-smi --query-gpu=temperature.gpu,memory.used,memory.total,utilization.gpu --format=noheader";

        const rawGPUStats = (await wrapIO(GpuPoller.logger, execAsync(cmd), `Unable to run ${cmd}`)).match(
            v => {
                var temperatures: number[] = [];
                var vRAMUsages: number[] = [];
                var cpuUsages: number[] = [];
                for (const line of v.split("\n")) {
                    const columns = line.split(",");
                    if (columns.length < 4) {
                        GpuPoller.logger.warn(`Retrieved line if in the wrong format: ${line}`);
                        continue;
                    }

                    const [rawTemperature, rawMemUsed, rawMemTotal, rawCpuUsagePercent] = columns;

                    const parsedTemperature = parseInt(rawTemperature);
                    if (isNaN(parsedTemperature)) {
                        GpuPoller.logger.warn(`Retrieved temperature in the wrong format: ${line}`);
                        continue;
                    }
                    temperatures.push(parsedTemperature);

                    // there's a trailing ' '
                    const memUsedRatio =
                        (parseInt(rawMemUsed.split(" ")[1]) / parseInt(rawMemTotal.split(" ")[1])) * 100;
                    if (isNaN(memUsedRatio)) {
                        GpuPoller.logger.warn(`Retrieved memUsed/MemTotal in the wrong format: ${line}`);
                        continue;
                    }
                    vRAMUsages.push(memUsedRatio);

                    const parsedCpuPercent = parseInt(rawCpuUsagePercent);
                    if (isNaN(parsedTemperature)) {
                        GpuPoller.logger.warn(`Retrieved cpu percent in the wrong format: ${line}`);
                        continue;
                    }
                    cpuUsages.push(parsedCpuPercent);
                }
                return {
                    temperatures: temperatures,
                    vRAMUsages: vRAMUsages,
                    cpuUsages: cpuUsages,
                } as RawGPUStas;
            },
            _ => undefined
        );

        if (rawGPUStats === undefined) {
            return {};
        }

        const cpuUsage =
            rawGPUStats.cpuUsages.reduce((acc: number, usage: any) => {
                return acc + usage;
            }, 0) / rawGPUStats.cpuUsages.length;

        const ramUsage =
            rawGPUStats.vRAMUsages.reduce((acc: number, usage: any) => {
                return acc + usage;
            }, 0) / rawGPUStats.vRAMUsages.length;

        const temp =
            rawGPUStats.temperatures.reduce((acc: number, temperature: any) => {
                return acc + temperature;
            }, 0) / rawGPUStats.temperatures.length;

        return {
            cpuUsage: cpuUsage,
            ramUsage: ramUsage,
            temp: temp,
        };
    }
}
