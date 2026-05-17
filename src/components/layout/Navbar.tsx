"use client";

import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import {
  alpha,
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MouseEvent, useEffect, useMemo, useState } from "react";
import RKStudioLogo from "@/components/common/RKStudioLogo";
import { useAuth } from "@/hooks/useAuth";
import { RK_STUDIO } from "@/utils/constants";
import { isAdminUser } from "@/utils/admin";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Stitch", href: "/tailoring" },
  { label: "Febric", href: "/fabric" },
  { label: "Dupatta", href: "/dupatta" },
  { label: "Cart", href: "/cart" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user && isAdminUser(user);

  const profileMenuOpen = Boolean(profileAnchor);
  const mobileLinks = useMemo(() => {
    const links = [...navLinks];

    if (user) {
      links.push({ label: "Profile", href: "/dashboard" });
      if (isAdmin) {
        links.push({ label: "Admin Panel", href: "/admin" });
        links.push({ label: "Manage Products", href: "/admin/products" });
      }
    } else {
      links.push({ label: "Login", href: "/login" });
    }

    return links;
  }, [isAdmin, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleProfileMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setProfileAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchor(null);
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: `1px solid ${alpha("#E2E8F0", 0.95)}`,
        bgcolor: "#FFFFFF",
        boxShadow: scrolled
          ? "0 10px 24px rgba(15, 23, 42, 0.08)"
          : "0 4px 12px rgba(15, 23, 42, 0.04)",
        transition: "box-shadow 0.25s ease",
      }}
    >
      <Toolbar
        sx={{
          maxWidth: 1240,
          width: "100%",
          mx: "auto",
          px: { xs: 1.5, md: 2.5 },
          minHeight: { xs: 80, md: 84 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr auto", md: "auto 1fr auto" },
          alignItems: "center",
          gap: { xs: 1.5, md: 2 },
        }}
      >
        <Box component={Link} href="/" sx={{ textDecoration: "none", color: "inherit", minWidth: 0, justifySelf: "start", display: "flex", alignItems: "center" }}>
          <RKStudioLogo size={48} variant="full" />
        </Box>

        <Stack
          direction="row"
          spacing={0.8}
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            justifyContent: "center",
            justifySelf: "center",
            minWidth: 0,
          }}
        >
          {navLinks.map((link) => (
            <Button
              key={link.href}
              component={Link}
              href={link.href}
              color="inherit"
              sx={{
                minWidth: 0,
                borderRadius: 999,
                px: 1.55,
                py: 0.72,
                whiteSpace: "nowrap",
                color: pathname === link.href ? "primary.main" : "text.primary",
                backgroundColor: pathname === link.href ? alpha("#DBEAFE", 0.95) : "transparent",
                border: `1px solid ${pathname === link.href ? alpha("#93C5FD", 0.65) : "transparent"}`,
                transition: "background-color 0.25s ease, color 0.25s ease",
                "&:hover": {
                  backgroundColor: pathname === link.href ? alpha("#DBEAFE", 1) : alpha("#F8FAFC", 0.92),
                },
              }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", justifySelf: "end", flexWrap: "nowrap" }}
        >
          <Button
            component="a"
            href={RK_STUDIO.whatsappChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<WhatsAppIcon />}
            sx={{
              borderRadius: 999,
              px: 1.6,
              py: 0.72,
              whiteSpace: "nowrap",
              minWidth: "fit-content",
              color: "#166534",
              bgcolor: alpha("#DCFCE7", 0.92),
              border: `1px solid ${alpha("#86EFAC", 0.86)}`,
              "&:hover": {
                bgcolor: alpha("#DCFCE7", 1),
              },
            }}
          >
            WhatsApp pe baat karein
          </Button>
          {user ? (
            <>
              <Button
                onClick={handleProfileMenuOpen}
                startIcon={<AccountCircleOutlinedIcon />}
                sx={{
                  borderRadius: 999,
                  px: 1.6,
                  py: 0.72,
                  whiteSpace: "nowrap",
                  minWidth: "fit-content",
                  color: "text.primary",
                  bgcolor: alpha("#FFFFFF", 0.96),
                  border: `1px solid ${alpha("#CBD5E1", 0.85)}`,
                  "&:hover": {
                    bgcolor: alpha("#F8FAFC", 1),
                  },
                }}
              >
                {user.displayName || "Profile"}
              </Button>
              <Menu
                anchorEl={profileAnchor}
                open={profileMenuOpen}
                onClose={handleProfileMenuClose}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 220,
                    borderRadius: 3,
                    border: `1px solid ${alpha("#E2E8F0", 0.9)}`,
                    boxShadow: "0 18px 38px rgba(15, 23, 42, 0.12)",
                  },
                }}
              >
                <MenuItem component={Link} href="/dashboard" onClick={handleProfileMenuClose}>
                  <AccountCircleOutlinedIcon sx={{ mr: 1.25, fontSize: 18 }} />
                  Profile
                </MenuItem>
                {isAdmin ? (
                  <MenuItem component={Link} href="/admin" onClick={handleProfileMenuClose}>
                    <AdminPanelSettingsOutlinedIcon sx={{ mr: 1.25, fontSize: 18 }} />
                    Admin Panel
                  </MenuItem>
                ) : null}
                {isAdmin ? (
                  <MenuItem component={Link} href="/admin/products" onClick={handleProfileMenuClose}>
                    <AdminPanelSettingsOutlinedIcon sx={{ mr: 1.25, fontSize: 18 }} />
                    Manage Products
                  </MenuItem>
                ) : null}
                <Divider />
                <MenuItem
                  onClick={async () => {
                    handleProfileMenuClose();
                    await logout();
                  }}
                >
                  <LogoutRoundedIcon sx={{ mr: 1.25, fontSize: 18 }} />
                  Logout
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              component={Link}
              href="/login"
              startIcon={<AccountCircleOutlinedIcon />}
              sx={{
                borderRadius: 999,
                px: 1.6,
                py: 0.72,
                whiteSpace: "nowrap",
                minWidth: "fit-content",
                color: "primary.main",
                bgcolor: alpha("#EFF6FF", 0.95),
                border: `1px solid ${alpha("#BFDBFE", 0.9)}`,
                "&:hover": {
                  bgcolor: alpha("#DBEAFE", 0.98),
                },
              }}
            >
              Login karein
            </Button>
          )}
        </Stack>

        <IconButton
          sx={{
            display: { xs: "inline-flex", md: "none" },
            bgcolor: alpha("#FFFFFF", 0.96),
            border: `1px solid ${alpha("#CBD5E1", 0.65)}`,
            boxShadow: "0 4px 10px rgba(15, 23, 42, 0.05)",
            justifySelf: "end",
          }}
          onClick={() => setOpen(true)}
          aria-label="Menu kholein"
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            p: 2,
            background: "#FFFFFF",
            borderLeft: `1px solid ${alpha("#E2E8F0", 0.95)}`,
          },
        }}
      >
        <Stack sx={{ width: "100%" }} spacing={1.6}>
          <RKStudioLogo size={38} variant="full" />
          <Button
            component="a"
            href={RK_STUDIO.whatsappChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<WhatsAppIcon />}
            sx={{
              justifyContent: "flex-start",
              borderRadius: 999,
              bgcolor: alpha("#DCFCE7", 0.95),
              color: "#166534",
              border: `1px solid ${alpha("#86EFAC", 0.84)}`,
            }}
          >
            WhatsApp pe baat karein
          </Button>
          <Divider />
          {mobileLinks.map((link) => (
            <Button
              key={link.href}
              component={Link}
              href={link.href}
              onClick={() => setOpen(false)}
              sx={{
                justifyContent: "flex-start",
                borderRadius: 999,
                px: 1.5,
                py: 0.85,
                color: pathname === link.href ? "primary.main" : "text.primary",
                backgroundColor: pathname === link.href ? alpha("#DBEAFE", 0.95) : "transparent",
                border: `1px solid ${pathname === link.href ? alpha("#93C5FD", 0.65) : "transparent"}`,
              }}
            >
              {link.label}
            </Button>
          ))}
          {user ? (
            <Button
              onClick={async () => {
                await logout();
                setOpen(false);
              }}
              startIcon={<LogoutRoundedIcon />}
              sx={{ justifyContent: "flex-start", borderRadius: 999 }}
            >
              Bahar niklein
            </Button>
          ) : null}
        </Stack>
      </Drawer>
    </AppBar>
  );
}
