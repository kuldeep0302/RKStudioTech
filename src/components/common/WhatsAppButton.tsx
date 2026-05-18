"use client";

import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { Fab } from "@mui/material";
import { useEffect, useState } from "react";
import { RK_STUDIO } from "@/utils/constants";

export default function WhatsAppButton() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const phone = RK_STUDIO.whatsappNumber;
  const message = "Hi, I want to know about tailoring";
  const href = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : RK_STUDIO.whatsappChatUrl;
  const whatsappUrl = href || `https://wa.me/918901501572?text=${encodeURIComponent(message)}`;

  const handleClick = () => {
    console.info("[whatsapp] floating button clicked", {
      href: whatsappUrl,
    });
  };

  if (!isClient) {
    return null;
  }

  return (
    <Fab
      component="a"
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Chat on WhatsApp"
      sx={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 999999,
        bgcolor: "#25D366",
        color: "#FFFFFF",
        cursor: "pointer",
        pointerEvents: "auto",
        userSelect: "none",
        opacity: 1,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        "&:hover": {
          bgcolor: "#1DAE57",
        },
      }}
    >
      <WhatsAppIcon />
    </Fab>
  );
}
