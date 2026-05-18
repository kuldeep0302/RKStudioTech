"use client";

import { Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { ProductFilters } from "@/utils/filters";

type FabricFiltersProps = {
  filters: ProductFilters;
  onChange: (next: ProductFilters) => void;
};

export default function FabricFilters({ filters, onChange }: FabricFiltersProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" mb={2}>
          Filter fabric
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Max rate"
            type="number"
            value={filters.maxPrice ?? ""}
            placeholder="No max limit"
            onChange={(event) => {
              const nextValue = event.target.value;

              onChange({
                ...filters,
                maxPrice: nextValue === "" ? null : Number(nextValue),
              });
            }}
          />

          <TextField
            select
            label="Fabric type"
            value={filters.type}
            onChange={(event) =>
              onChange({
                ...filters,
                type: event.target.value,
              })
            }
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="cotton">Cotton</MenuItem>
            <MenuItem value="rayon">Rayon</MenuItem>
            <MenuItem value="silk">Silk</MenuItem>
            <MenuItem value="linen">Linen</MenuItem>
          </TextField>
        </Stack>
      </CardContent>
    </Card>
  );
}
