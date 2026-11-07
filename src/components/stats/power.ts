import { Gio, Variable } from "astal";
import { Logger } from "src/core/lang/log";
import { EagerPoll } from "../common/variable";
import { Poller } from "./poller";
import { Optional } from "src/core/matcher/optional";
import { ConfigManager } from "src/core/config/configmanager";
import { DefaultKVConfigValues } from "src/core/config/kvconfig";
import { readNumber, readString } from "src/core/files";
import { Asyncify } from "src/core/async/helper";

export interface PowerStats {
    readonly charing?: boolean;
    readonly level?: number;
    readonly remaining?: string;
}

interface ParsedPowerStats {
    status: Optional<StatusType>;
    level: number;
    remaining?: string;
}

export const Status = {
    DISCHARGING: "Discharging",
    CHARGING: "Charging",
    NOT_CHARGING: "Not Charging",
} as const;

export type StatusType = (typeof Status)[keyof typeof Status];

const translationMap: Record<string, StatusType> = {
    charging: Status.CHARGING,
    discharging: Status.DISCHARGING,
    "not charging": Status.NOT_CHARGING,
    not_charging: Status.NOT_CHARGING,
};

export function translateToStatus(input: string): Optional<StatusType> {
    const normalized = input.trim().toLowerCase();
    const matchedStatus = translationMap[normalized];

    if (!matchedStatus) {
        return Optional.none();
    }

    return Optional.some(matchedStatus);
}

export class PowerPoller implements Poller<PowerStats> {
    private static logger: Logger = Logger.get(PowerPoller);

    private static MAIN_BATTERY_CAPACITY: string = "/sys/class/power_supply/BAT1/capacity";
    private static MAIN_BATTERY_STATUS: string = "/sys/class/power_supply/BAT1/status";
    private static MAIN_BATTERY_CHARGE_NOW: string = "/sys/class/power_supply/BAT1/charge_now";
    private static MAIN_BATTERY_CHARGE_FULL: string = "/sys/class/power_supply/BAT1/charge_full";
    private static MAIN_BATTERY_CURRENT_NOW: string = "/sys/class/power_supply/BAT1/current_now";

    public pollerVariable(frequency: number): Variable<PowerStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
    }

    public async stats(): Promise<PowerStats> {
        const showPower = ConfigManager.instace()
            .config.get()
            .apply(c => c.showPower)
            .getOr(DefaultKVConfigValues.SHOW_POWER);
        if (!showPower) return {};

        const [optStatus, optCapacity, optChargeNow, optChargeFull, optCurrentNow] = await Promise.all([
            Asyncify.from(readString)(PowerPoller.MAIN_BATTERY_STATUS),
            Asyncify.from(readNumber)(PowerPoller.MAIN_BATTERY_CAPACITY),
            Asyncify.from(readNumber)(PowerPoller.MAIN_BATTERY_CHARGE_NOW),
            Asyncify.from(readNumber)(PowerPoller.MAIN_BATTERY_CHARGE_FULL),
            Asyncify.from(readNumber)(PowerPoller.MAIN_BATTERY_CURRENT_NOW),
        ]);

        if (optStatus.isNone() || optCapacity.isNone()) return {};

        const optSeconds =
            optChargeNow.isNone() || optChargeFull.isNone() || optCurrentNow.isNone()
                ? Optional.none()
                : remainingSeconds(
                      optStatus.unwrap(),
                      optChargeNow.unwrap(),
                      optChargeFull.unwrap(),
                      optCurrentNow.unwrap()
                  );

        const parsedPowerStatus: ParsedPowerStats = {
            status: translateToStatus(optStatus.unwrap()),
            level: optCapacity.unwrap(),
            remaining: optSeconds.apply(formatHms).get(),
        };

        return {
            charing: parsedPowerStatus.status.apply(s => Status.CHARGING === s).getOr(false),
            level: parsedPowerStatus.level,
            remaining: parsedPowerStatus.remaining,
        };
    }
}

export function remainingSeconds(
    status: string,
    chargeNow: number,
    chargeFull: number,
    currentNow: number
): Optional<number> {
    const rate = Math.abs(currentNow);
    if (rate === 0) return Optional.none();
    if (status === "Discharging") return Optional.some((chargeNow / rate) * 3600);
    if (status === "Charging") return Optional.some(((chargeFull - chargeNow) / rate) * 3600);
    return Optional.none();
}

export function formatHms(secs: number): string {
    const s = Math.round(secs);
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(x => String(x).padStart(2, "0")).join(":");
}
