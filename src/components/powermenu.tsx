import { execAsync } from "astal";
import { Gdk, Gtk } from "astal/gtk3";
import { Logger } from "src/core/lang/log";
import { wrapIO } from "src/core/matcher/base";
import { Menu, MenuItem } from "./common/astalified";
import { MouseEvents } from "./common/events";
import { ConfigManager } from "src/core/config/configmanager";
import { DefaultKVConfigValues, POWER_MENU_LOGINCTL } from "src/core/config/kvconfig";

export const PowerMenuButton = (): JSX.Element => {
    const logger = Logger.get(PowerMenuButton);

    const menu = (
        <Menu halign={Gtk.Align.START} className="power-menu-box">
            <MenuItem
                className="power-menu-item"
                label="󰍃 Logout"
                onButtonPressEvent={MouseEvents.onPrimaryHandler(() =>
                    wrapIO(logger, execAsync("hyprctl dispatch 'hl.dsp.exit()'"), "Failed logout")
                )}
            />
            <MenuItem
                className="power-menu-item"
                label=" Lock"
                onButtonPressEvent={MouseEvents.onPrimaryHandler(() =>
                    wrapIO(logger, execAsync("hyprlock"), "Failed lock")
                )}
            />
            <MenuItem
                className="power-menu-item"
                label="󰜉 Reboot"
                onButtonPressEvent={MouseEvents.onPrimaryHandler(() => {
                    const powerManager = ConfigManager.instace().config.get()
                        .apply(c => c.powerManager)
                        .getOr(DefaultKVConfigValues.POWER_MANAGER);
                    wrapIO(logger, execAsync(`${powerManager} reboot`), "Failed reboot")
                })}
            />
            <MenuItem
                className="power-menu-item"
                label="󰐥 Power off"
                onButtonPressEvent={MouseEvents.onPrimaryHandler(() => {
                    const powerManager = ConfigManager.instace().config.get()
                        .apply(c => c.powerManager)
                        .getOr(DefaultKVConfigValues.POWER_MANAGER);
                    wrapIO(logger, execAsync(`${powerManager} poweroff`), "Failed poweroff")
                })}
            />
        </Menu>
    ) as Gtk.Menu;

    return (
        <eventbox
            cursor={"pointer"}
            onButtonPressEvent={MouseEvents.onPrimaryHandler(target =>
                (menu as Gtk.Menu).popup_at_widget(target, Gdk.Gravity.NORTH, Gdk.Gravity.SOUTH, null)
            )}
        >
            <box className="bar-item power-menu">
                <label className="power-button" label="󰐥" tooltipText="Power menu" />
            </box>
        </eventbox>
    );
};
