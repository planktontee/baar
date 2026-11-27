import { Variable } from "astal";
import { bind } from "astal/binding";
import Hyprland from "gi://AstalHyprland";
import { Gtk } from "astal/gtk3";
import { toSubscript } from "src/core/symbols";
import { Optional } from "src/core/matcher/optional";
import { EagerPoll } from "./common/variable";
import { ConfigManager } from "src/core/config/configmanager";
import { DefaultKVConfigValues } from "src/core/config/kvconfig";
import { attachHorizontalScroll, followFocusedClass } from "./common/scroll";

const WORKSPACES_MAX_WIDTH = 70;

const hypr = Hyprland.get_default();

export function activeWorkspaces(monitors: Hyprland.Monitor[]): Hyprland.Workspace[] {
    return monitors.map(monitor => monitor.activeWorkspace).filter(monitor => monitor !== null);
}

export function workspaceClass(
    workspace: Hyprland.Workspace,
    focused: Hyprland.Workspace,
    actives: Hyprland.Workspace[]
): string {
    if (workspace === focused) {
        return "ws-tracker ws-active ws-focused";
    } else if (actives.includes(workspace)) {
        return "ws-tracker ws-active ws-unfocused";
    } else {
        return "ws-tracker ws-inactive";
    }
}

// Todo: make more pieces static
export function Workspaces() {
    const v = Variable.derive(
        [bind(hypr, "workspaces"), bind(hypr, "focusedWorkspace"), bind(hypr, "monitors")],
        (workspaces, focused, monitors) => {
            const filtered = workspaces.filter(ws => !(ws.id >= -99 && ws.id <= -2) && !ws.name.startsWith("special:")); // filter out special workspaces

            monitors = monitors.sort((a, b) => a.get_x() - b.get_x());
            const actives = activeWorkspaces(monitors);

            const jsxRemaining = monitors.map((monitor, index) => {
                const forMonitor = filtered
                    .sort((a, b) => a.id - b.id)
                    .filter(ws => ws.monitor == monitor)
                    .map(ws => (
                        <box className="workspaces">
                            <button
                                cursor={"pointer"}
                                className={`${workspaceClass(ws, focused, actives)}`}
                                onClicked={() => hypr.dispatch("", `hl.dsp.focus({ workspace = ${ws.id.toString()} })`)}
                            >
                                {ws.id}
                            </button>
                        </box>
                    ));
                const baseItems = [<label className="ws-monitor-n" label={`${toSubscript(index + 1)}`} />, forMonitor];
                if (monitors.length !== index + 1) {
                    baseItems.push(<label label="┃" />);
                }
                return baseItems;
            });

            return jsxRemaining;
        }
    );

    const content = (<box>{bind(v)}</box>) as Gtk.Box;
    const configReloaded = new Variable(0);
    ConfigManager.instace().config.onLoadNofity(async () => {
        configReloaded.set(configReloaded.get() ^ 1);
    });

    const naturalW = new Variable(0);
    const targetW = Variable.derive(
        [
            bind(naturalW),
            bind(configReloaded),
        ],
        (natural, ...argv: any[]) => {
            const compactMode = ConfigManager.instace()
                .config.get()
                .apply(config => config.compactMode)
                .getOr(DefaultKVConfigValues.COMPACT_MODE);

            return compactMode ? Math.min(natural, WORKSPACES_MAX_WIDTH) : natural;
        }
    );
    const scrollV = new Variable<Optional<Gtk.ScrolledWindow>>(Optional.none());

    EagerPoll.create(41, async () => {
        scrollV.get().apply(scroll => {
            if (targetW.get() === scroll.get_allocated_width()) {
                return;
            }

            scroll.set_size_request(targetW.get(), scroll.get_allocated_height());
            scroll.queue_resize();
        });
    });

    content.connect_after("size-allocate", () => {
        const [, natural] = content.get_preferred_width();
        naturalW.set(natural);
    });

    return (
        <box className="bar-item" tooltipText="Workspace tracker">
            <label label="󰘔⁝ " />
            <scrollable
                hscrollbar_policy={Gtk.PolicyType.EXTERNAL}
                vscrollbar_policy={Gtk.PolicyType.NEVER}
                setup={self => {
                    scrollV.set(Optional.some(self));
                    attachHorizontalScroll(self);
                    followFocusedClass(self, content, "ws-focused", hypr, ["notify::focused-workspace"]);
                }}
            >
                {content}
            </scrollable>
        </box>
    );
}
