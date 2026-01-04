import { bind, Binding, Variable } from "astal";
import { CpuPoller } from "./stats/cpu";
import { GpuPoller } from "./stats/gpu";
import { RamPoller } from "./stats/ram";

interface PollerLabelProps {
    readonly symbol: string;
    readonly className: string;
    readonly poller: Binding<string>;
    readonly tooltip: string;
}

export const PollerLabel = (props: PollerLabelProps): JSX.Element => {
    return (
        <box className="bar-item poller-item" tooltipText={props.tooltip}>
            <label className={props.className} label={`${props.symbol}┃`} />
            <label label={props.poller} />
        </box>
    );
};

export function fmt(v?: number, floatPoint: number = 1, pad: number = 5): string {
    if (v === undefined) {
        return "";
    }
    return v.toFixed(floatPoint).padStart(pad, " ");
}

const CPU_COMPONENT_POLLER = new CpuPoller().pollerVariable(1000);
const GPU_COMPONENT_POLLER = new GpuPoller().pollerVariable(1000);
const RAM_COMPONENT_POLLER = new RamPoller().pollerVariable(1000);

export const CPU_POLLER = bind(CPU_COMPONENT_POLLER).as(cpuStats =>
    cpuStats ? `${fmt(cpuStats.usage)}%  ${fmt(cpuStats.temp, 0, 3)}󰔄` : ""
);

export const GPU_POLLER = bind(GPU_COMPONENT_POLLER).as(gpuStats =>
    gpuStats !== null ? `${fmt(gpuStats.cpuUsage)}% ${fmt(gpuStats.ramUsage)}%  ${fmt(gpuStats.temp, 0, 3)}󰔄` : ""
);

export const RAM_POLLER = bind(RAM_COMPONENT_POLLER).as(ramStats =>
    ramStats !== null ? `${fmt(ramStats.usage)}%` : ""
);

export const COMPACT_POLLER_USAGE = bind(Variable.derive(
    [
        bind(CPU_COMPONENT_POLLER),
        bind(GPU_COMPONENT_POLLER),
        bind(RAM_COMPONENT_POLLER),
    ],
    (cpuStats, gpuStats, ramStats) => {
        const cpuUsage = cpuStats !== null ? `${fmt(cpuStats.usage)} ` : "";
        const gpuUsage = gpuStats !== null ? `󰢮${fmt(gpuStats.ramUsage)} ` : "";
        const ramUsage = ramStats !== null ? `${fmt(ramStats.usage)}` : "";
        return `${cpuUsage}${gpuUsage}${ramUsage}`;
    }
));

export const COMPACT_POLLER_TEMP = bind(Variable.derive(
    [
        bind(CPU_COMPONENT_POLLER),
        bind(GPU_COMPONENT_POLLER),
    ],
    (cpuStats, gpuStats) => {
        const cpuTemp = cpuStats !== null ? `${fmt(cpuStats.temp)} ` : "";
        const gpuTemp = gpuStats !== null ? `󰢮${fmt(gpuStats.temp)} ` : "";
        return `${cpuTemp}${gpuTemp}`;
    }
));

export function dashboardLoaded(): bool {
    return (
        CPU_POLLER.get() !== "" &&
        GPU_POLLER.get() !== "" &&
        RAM_POLLER.get() !== ""
    );
}
