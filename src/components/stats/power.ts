import { execAsync, Variable } from "astal";
import { Logger } from "src/core/lang/log";
import { wrapIO } from "src/core/matcher/base";
import { EagerPoll } from "../common/variable";
import { Poller } from "./poller";
import { Optional } from "src/core/matcher/optional";
import { ConfigManager } from "src/core/config/configmanager";
import { DefaultKVConfigValues } from "src/core/config/kvconfig";

export interface PowerStats {
    readonly charing?: boolean;
    readonly level?: number;
    readonly remaining?: string;
}

interface ParsedPowerStats {
    batteryN: number;
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
    not_charging: Status.NOT_CHARGING, // handles underscores too
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

    public pollerVariable(frequency: number): Variable<PowerStats | null> {
        return EagerPoll.create(frequency, this.stats.bind(this));
    }

    // Todo: use a different strategy, gpustart is taking 181ms
    public async stats(): Promise<PowerStats> {
        const showPower = ConfigManager.instace()
            .config.get()
            .apply(c => c.showPower)
            .getOr(DefaultKVConfigValues.SHOW_POWER);
        if (!showPower) return {};

        const cmd = "acpi";

        const parsedPowerStatus = (await wrapIO(PowerPoller.logger, execAsync(cmd), `Unable to run ${cmd}`)).match(
            v => {
                // Battery 0: Not charging, 80%
                const match = v.match(
                    /Battery (?<batteryN>\d+): (?<status>[^,]+), (?<level>\d+)%(?:, (?<remaining>.+))?/
                );
                if (match) {
                    const { batteryN, status, level, remaining } = match.groups;
                    return {
                        batteryN: parseInt(batteryN, 10),
                        status: translateToStatus(status),
                        level: parseInt(level, 10),
                        remaining: remaining,
                    } as ParsedPowerStats;
                }
            },
            _ => undefined
        );

        if (parsedPowerStatus === undefined) {
            return {};
        }

        return {
            charing: parsedPowerStatus.status.apply(s => Status.CHARGING === s).getOr(false),
            level: parsedPowerStatus.level,
            remaining: parsedPowerStatus.remaining,
        };
    }
}
