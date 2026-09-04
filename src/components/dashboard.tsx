import { Gio, Variable, bind } from "astal";
import { Gtk, Gdk, Astal } from "astal/gtk3";
import { ConfigManager } from "src/core/config/configmanager";
import { PollerLabel, CPU_POLLER, GPU_POLLER, RAM_POLLER, COMPACT_POLLER_USAGE, COMPACT_POLLER_TEMP, POWER_POLLER, POWER_TOOLTIP_POLLER } from "./pollerlabel";
import { DefaultKVConfigValues, KVConfig } from "src/core/config/kvconfig";
import { Logger } from "src/core/lang/log";

export const Dashboard = (): Gtk.Widget => {
    const showUsageVar = new Variable(0);
    const configReloaded = new Variable(0);
    ConfigManager.instace().config.onLoadNofity(async () => {
        configReloaded.set(configReloaded.get() ^ 1);
    });

    const components = Variable.derive(
        [
            bind(showUsageVar),
            bind(configReloaded),
        ],
        (showUsage, ...argv: any[]) => {
            const compactDashboard = ConfigManager.instace()
                .config.get()
                .apply(config => config.compactDashboard)
                .getOr(DefaultKVConfigValues.COMPACT_DASHBOARD)

            const showPowerUsage = ConfigManager.instace()
                .config.get()
                .apply(config => config.showPower)
                .getOr(DefaultKVConfigValues.SHOW_POWER);

            if (compactDashboard) {
                const compactDash = (() => {
                    if (showUsage) {
                        return <PollerLabel tooltip="Usage rate (CPU, GPU, RAM)" symbol="⧊" className="compact-poller" poller={COMPACT_POLLER_USAGE} />
                    }
                    else {
                        // TODO: add battery remaining to tooltip
                        return <PollerLabel tooltip="Temperature (CPU, GPU) and battery level" symbol="" className="compact-poller" poller={COMPACT_POLLER_TEMP} />
                    }
                })();

                return (
                    <button
                        cursor={"pointer"}
                        className="bar-dashboard"
                        onClick={(_, event) => {
                            if (event.button === Astal.MouseButton.PRIMARY || event.button === Astal.MouseButton.SECONDARY) {
                                showUsageVar.set(showUsage ^ 1);
                            }
                        }}
                    >
                        {compactDash}
                    </button>
                );
            }
            else {
                const powerWidget = showPowerUsage ? (
                    <PollerLabel tooltipPoller={POWER_TOOLTIP_POLLER} className="power-poller" poller={POWER_POLLER} />
                ) : null;

                return (
                    <box
                        className="bar-dashboard"
                        orientation={Gtk.Orientation.HORIZONTAL}
                    >
                        <PollerLabel tooltip="CPU Info" symbol="" className="cpu-poller" poller={CPU_POLLER} />
                        <PollerLabel tooltip="GPU Info" symbol="󰢮" className="gpu-poller" poller={GPU_POLLER} />
                        <PollerLabel tooltip="RAM Info" symbol="" className="ram-poller" poller={RAM_POLLER} />
                        {powerWidget}
                    </box>
                );
            }
        }
    )

    return bind(components);
};

export default { Dashboard };
