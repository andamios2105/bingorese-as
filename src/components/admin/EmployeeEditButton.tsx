"use client";

import { useState } from "react";
import EmployeeEditModal from "./EmployeeEditModal";

export default function EmployeeEditButton({
  promoterId,
  fullName,
  phone,
  paymentMethod,
  paymentNumber,
}: {
  promoterId: string;
  fullName: string;
  phone: string | null;
  paymentMethod: string | null;
  paymentNumber: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-sky-400"
      >
        Editar
      </button>

      {open && (
        <EmployeeEditModal
          promoterId={promoterId}
          initialFullName={fullName}
          initialPhone={phone}
          initialPaymentMethod={paymentMethod}
          initialPaymentNumber={paymentNumber}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
