import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  className = "",
  placeholder = "R$ 0,00",
  disabled = false,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    return value ? brl(value) : "";
  });

  useEffect(() => {
    setDisplayValue(value ? brl(value) : "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Extrai apenas os dígitos
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      onChange(0);
      setDisplayValue("");
      return;
    }

    const numericValue = Number(digits) / 100;
    onChange(numericValue);
    setDisplayValue(brl(numericValue));
  };

  return (
    <div className="relative flex items-center">
      <Input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`text-right font-medium tabular-nums transition-all focus:ring-1 focus:ring-primary ${className}`}
      />
    </div>
  );
}
