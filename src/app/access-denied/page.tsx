"use client";

import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import Link from "next/link";
import Layout from "@/components/layout/Layout";

export default function AccessDeniedPage() {
  return (
    <Layout>
      <Card>
        <CardContent>
          <Stack spacing={2.2} alignItems="flex-start">
            <Typography variant="h3">Access Denied</Typography>
            <Typography color="text.secondary">
              You don&apos;t have permission to view this page.
            </Typography>
            <Button component={Link} href="/" variant="contained">
              Go to Home
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Layout>
  );
}
