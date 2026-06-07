import { bind, Binding, Variable } from "astal";
import { CpuPoller } from "./stats/cpu";
import { GpuPoller } from "./stats/gpu";
import { RamPoller } from "./stats/ram";
import { PowerPoller, PowerStats } from "./stats/power";
import { Optional } from "src/core/matcher/optional";
import { ConfigManager } from "src/core/config/configmanager";

interface PollerLabelProps {
    readonly symbol?: string;
    readonly className: string;
    readonly poller: Binding<string>;
    readonly tooltip?: string;
    readonly tooltipPoller?: Binding<string>;
}

export const PollerLabel = (props: PollerLabelProps): JSX.Element => {
    return (
        <box className="bar-item poller-item" tooltipText={props.tooltipPoller !== undefined ? props.tooltipPoller : props.tooltip}>
            <label className={props.className} label={props.symbol !== undefined ? `${props.symbol}┃` : ""} />
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
const POWER_COMPONENT_POLLER = new PowerPoller().pollerVariable(1000);

export const CPU_POLLER = bind(CPU_COMPONENT_POLLER).as(cpuStats =>
    cpuStats ? `${fmt(cpuStats.usage)}%  ${fmt(cpuStats.temp, 0, 3)}󰔄` : ""
);

export const GPU_POLLER = bind(GPU_COMPONENT_POLLER).as(gpuStats =>
    gpuStats !== null ? `${fmt(gpuStats.cpuUsage)}% ${fmt(gpuStats.ramUsage)}%  ${fmt(gpuStats.temp, 0, 3)}󰔄` : ""
);

export const RAM_POLLER = bind(RAM_COMPONENT_POLLER).as(ramStats =>
    ramStats !== null ? `${fmt(ramStats.usage)}%` : ""
);

export const POWER_POLLER = bind(POWER_COMPONENT_POLLER).as(powerStats =>
    formatPowerStats(powerStats)
);

export const POWER_TOOLTIP_POLLER = bind(POWER_COMPONENT_POLLER).as(powerStats =>
    powerStats !== null && powerStats.remaining !== undefined ? powerStats.remaining : "Power Info"
);

function formatPowerStats(powerStats: PowerStats | null | undefined): string {
    return Optional.from(powerStats)
        .apply(p => {
            var icon = Optional.from(p.charing)
                .apply(p => p ? "󰂄" : undefined)
                .get();
            
            if (icon === undefined) {
                icon = Optional.from(p.level)
                    .apply(toPowerGlyph)
                    .get();
            }
            
            if (icon === undefined) return ""; 

            return Optional.from(p.level)
                .apply(l => `${icon}${fmt(l, 0, 3)}`)
                .getOr("");
        })
        .getOr("");

}

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

const configReloaded = new Variable(0);

ConfigManager.instace().config.onLoadNofity(async () => {
    configReloaded.set(configReloaded.get() ^ 1);
});

const POWER_GLYPHS: Record<number, string> = {
    0: '󰂎',
    10: '󰁺',
    20: '󰁻',
    30: '󰁼',
    40: '󰁽',
    50: '󰁾', 
    60: '󰁿',
    70: '󰂀',
    80: '󰂁',
    90: '󰂂',
    100: '󰁹'
};

function toPowerGlyph(value: number): string {
    return POWER_GLYPHS[Math.round(Math.max(0, Math.min(100, value)) / 10) * 10];
}

export const COMPACT_POLLER_TEMP = bind(Variable.derive(
    [
        bind(CPU_COMPONENT_POLLER),
        bind(GPU_COMPONENT_POLLER),
        bind(POWER_COMPONENT_POLLER),
        bind(configReloaded)
    ],
    (cpuStats, gpuStats, powerStats) => {
        const cpuTemp = cpuStats !== null ? `${fmt(cpuStats.temp)} ` : "";
        const gpuTemp = gpuStats !== null ? `󰢮${fmt(gpuStats.temp)} ` : "";
        const power = formatPowerStats(powerStats);

        return `${cpuTemp}${gpuTemp}${power}`;
    }
));

export function dashboardLoaded(): bool {
    return (
        CPU_POLLER.get() !== "" &&
        GPU_POLLER.get() !== "" &&
        RAM_POLLER.get() !== "" &&
        POWER_POLLER.get() !== ""
    );
}
