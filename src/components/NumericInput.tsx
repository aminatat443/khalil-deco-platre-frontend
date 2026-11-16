import { useEffect, useRef, useState, type ChangeEventHandler, type InputHTMLAttributes } from "react";

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number | string | null | undefined;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export default function NumericInput({ value, onChange, onFocus, onBlur, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value == null ? "" : String(value));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      value={draft}
      onFocus={(event) => {
        focused.current = true;
        if (event.currentTarget.value === "0") event.currentTarget.select();
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        onChange(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        setDraft(value == null ? "" : String(value));
        onBlur?.(event);
      }}
    />
  );
}
