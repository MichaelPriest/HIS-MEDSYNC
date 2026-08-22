"use client";

import { useState } from "react";

type MaskType = "cpf" | "cnpj" | "cep" | "telefone";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  mask: MaskType;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

function digits(value: string) { return value.replace(/\D/g, ""); }

function formatCpf(value: string) {
  const v = digits(value).slice(0, 11);
  return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCnpj(value: string) {
  const v = digits(value).slice(0, 14);
  return v.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatCep(value: string) {
  const v = digits(value).slice(0, 8);
  return v.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function formatPhone(value: string) {
  const v = digits(value).slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function applyMask(type: MaskType, value: string) {
  if (type === "cpf") return formatCpf(value);
  if (type === "cnpj") return formatCnpj(value);
  if (type === "cep") return formatCep(value);
  return formatPhone(value);
}

export function MaskedInput({ mask, defaultValue, value: controlledValue, className = "ui-input", onChange, ...props }: Props) {
  const [internalValue, setInternalValue] = useState(() => applyMask(mask, String(defaultValue ?? controlledValue ?? "")));
  const value = controlledValue !== undefined ? applyMask(mask, String(controlledValue)) : internalValue;

  return <input {...props} className={className} value={value} onChange={(event) => {
    const masked = applyMask(mask, event.target.value);
    if (controlledValue === undefined) setInternalValue(masked);
    event.target.value = masked;
    onChange?.(event);
  }} />;
}
