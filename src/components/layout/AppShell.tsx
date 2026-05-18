"use client";

import { ReactNode, useState } from "react";
import WhatsAppButton from "@/components/common/WhatsAppButton";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Navbar open={open} setOpen={setOpen} />
      {children}
      <Footer />
      {!open ? <WhatsAppButton /> : null}
    </>
  );
}
