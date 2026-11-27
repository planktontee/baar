import { GObject } from "astal";
import { Gdk, Gtk } from "astal/gtk3";
import { isScrollDown, isScrollUp } from "./events";

export function attachHorizontalScroll(scroll: Gtk.ScrolledWindow): void {
    scroll.connect("scroll-event", (_, event: Gdk.Event) => {
        const [, , yScroll] = event.get_scroll_deltas();

        let modifier = undefined;
        if (isScrollUp(event)) {
            modifier = yScroll < 0 ? 1 : -1;
        } else if (isScrollDown(event)) {
            modifier = 1;
        } else {
            return false;
        }

        const adj = scroll.get_hadjustment();
        adj.set_value((adj.get_value() + 30 * yScroll) * modifier);
        scroll.set_hadjustment(adj);
        return true;
    });
}

function findByClass(widget: Gtk.Widget, cls: string): Gtk.Widget | null {
    if (widget.get_style_context().has_class(cls)) {
        return widget;
    }
    if (widget instanceof Gtk.Container) {
        for (const child of widget.get_children()) {
            const found = findByClass(child, cls);
            if (found !== null) {
                return found;
            }
        }
    }
    return null;
}

function revealByClass(scroll: Gtk.ScrolledWindow, content: Gtk.Widget, cls: string): void {
    const target = findByClass(content, cls);
    if (target === null) {
        return;
    }

    const [ok, x] = target.translate_coordinates(content, 0, 0);
    if (!ok) {
        return;
    }

    const width = target.get_allocated_width();
    const adj = scroll.get_hadjustment();
    const value = adj.get_value();
    const page = adj.get_page_size();

    if (x < value) {
        adj.set_value(x);
    } else if (x + width > value + page) {
        adj.set_value(x + width - page);
    }
}

export function followFocusedClass(
    scroll: Gtk.ScrolledWindow,
    content: Gtk.Widget,
    cls: string,
    source: GObject.Object,
    signals: string[]
): void {
    let pending = false;

    const ids = signals.map(signal =>
        source.connect(signal, () => {
            pending = true;
            content.queue_resize();
        })
    );

    content.connect("size-allocate", () => {
        if (pending) {
            pending = false;
            revealByClass(scroll, content, cls);
        }
    });

    content.connect("destroy", () => {
        ids.forEach(id => source.disconnect(id));
    });
}
