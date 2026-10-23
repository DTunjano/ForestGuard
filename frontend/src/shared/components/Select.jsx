import { Children, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCheck, LuChevronDown } from "react-icons/lu";

function position(element) {
  const rect = element.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return null;
  const below = window.innerHeight - rect.bottom - 12;
  const above = below < 180 && rect.top > below;
  return {
    left: Math.max(8, rect.left),
    width: Math.min(rect.width, window.innerWidth - 16),
    maxHeight: Math.min(300, Math.max(100, above ? rect.top - 12 : below)),
    ...(above
      ? { bottom: window.innerHeight - rect.top + 6 }
      : { top: rect.bottom + 6 }),
  };
}

// The native field preserves FormData/reset semantics; the accessible listbox
// supplies consistent rendering instead of the operating system's blue picker.
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  ...props
}) {
  const uid = useId();
  const trigger = useRef(null);
  const menu = useRef(null);
  const native = useRef(null);
  const options = Children.toArray(children).map((option) => ({
    value: String(option.props.value ?? option.props.children),
    label: option.props.children,
    disabled: option.props.disabled,
  }));
  const [local, setLocal] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const selected = String(value ?? local);
  const selectedIndex = options.findIndex(
    (option) => option.value === selected,
  );
  const [popup, setPopup] = useState(null);
  const isOpen = !!popup;
  const [active, setActive] = useState(0);
  const search = useRef({ text: "", time: 0 });
  function close() {
    setPopup(null);
  }
  function open() {
    if (disabled) return;
    setPopup(position(trigger.current));
    setActive(Math.max(0, selectedIndex));
  }
  function choose(index) {
    if (!options[index] || options[index].disabled) return;
    const next = options[index].value;
    setLocal(next);
    onChange?.({
      target: { value: next, name },
      currentTarget: { value: next, name },
    });
    close();
    trigger.current.focus();
  }
  useEffect(() => {
    if (!isOpen) return;
    const outside = (event) => {
      if (
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      )
        setPopup(null);
    };
    const scroll = (event) => {
      if (!menu.current?.contains(event.target))
        setPopup(position(trigger.current));
    };
    document.addEventListener("pointerdown", outside);
    const resize = () => setPopup(position(trigger.current));
    const observer = new ResizeObserver(resize);
    observer.observe(trigger.current);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [isOpen]);
  useEffect(() => {
    const option = document.getElementById(`${uid}-${active}`);
    const list = menu.current;
    if (!isOpen || !option || !list) return;
    // Scroll only the list, never the document behind a fixed popup.
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [active, isOpen, uid]);
  useEffect(() => {
    const form = native.current?.form;
    const reset = () => {
      setLocal(String(defaultValue ?? ""));
      setPopup(null);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  function keyDown(event) {
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)
    )
      event.preventDefault();
    if (event.key === "Escape" || event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (popup) choose(active);
      else open();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      if (!popup) {
        open();
        return;
      }
      const direction = event.key === "ArrowUp" || event.key === "End" ? -1 : 1;
      let next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : active + direction;
      while (next >= 0 && next < options.length && options[next].disabled)
        next += direction;
      if (next >= 0 && next < options.length) setActive(next);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.time < 700 ? search.current.text : "") +
          event.key.toLowerCase(),
        time: now,
      };
      const next = options.findIndex(
        (option) =>
          !option.disabled &&
          String(option.label).toLowerCase().startsWith(search.current.text),
      );
      if (next >= 0) {
        if (!popup) open();
        setActive(next);
      }
    }
  }
  return (
    <div className="fg-select">
      <select
        ref={native}
        name={name}
        value={selected}
        onChange={(event) => {
          setLocal(event.target.value);
          onChange?.(event);
        }}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="fg-select-native"
        {...props}
      >
        {children}
      </select>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={id ? `${id}-label` : undefined}
        aria-label={props["aria-label"]}
        aria-expanded={!!popup}
        aria-controls={`${uid}-list`}
        aria-haspopup="listbox"
        aria-activedescendant={popup ? `${uid}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (popup ? close() : open())}
        onKeyDown={keyDown}
        onBlur={close}
        className="fg-select-trigger"
      >
        <span>{options[selectedIndex]?.label || "Selecciona una opción"}</span>
        <LuChevronDown aria-hidden="true" />
      </button>
      {popup &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            id={`${uid}-list`}
            role="listbox"
            aria-labelledby={id ? `${id}-label` : undefined}
            style={popup}
            className="fg-select-menu"
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                id={`${uid}-${index}`}
                role="option"
                aria-selected={selected === option.value}
                aria-disabled={!!option.disabled}
                data-active={active === index}
                data-value={option.value}
                className="fg-select-option"
                onPointerMove={() => {
                  if (!option.disabled) setActive(index);
                }}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {selected === option.value && <LuCheck aria-hidden="true" />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
