"use client";

import {
  Box,
  Chip,
  Step,
  StepConnector,
  stepConnectorClasses,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CancelIcon from "@mui/icons-material/Cancel";
import { StepIconProps } from "@mui/material/StepIcon";
import { OrderStatus } from "@/services/orderService";

// ---- Step definitions ----
type TimelineStepKey = "pending" | "accepted" | "in_progress" | "completed";

const STEPS: Array<{ key: TimelineStepKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

// ---- Map any OrderStatus to a 0-based step index ----
function statusToStepIndex(status: OrderStatus): number {
  const s = (status ?? "").toLowerCase();
  if (s === "pending") return 0;
  if (s === "accepted") return 1;
  if (s === "stitching" || s === "in_progress" || s === "in progress" || s === "ready") return 2;
  if (s === "delivered" || s === "done" || s === "completed") return 3;
  return 0;
}

function isRejected(status: OrderStatus) {
  return (status ?? "").toLowerCase() === "rejected";
}

// ---- Custom horizontal connector (green when completed/active) ----
const ColorConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 11,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.success.main,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.success.main,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.grey[300],
    borderRadius: 1,
  },
}));

// ---- Custom step icon per state ----
interface ColorStepIconProps extends StepIconProps {
  activeIndex: number;
  stepIndex: number;
}

function ColorStepIcon({ activeIndex, stepIndex }: ColorStepIconProps) {
  const isCompleted = stepIndex < activeIndex;
  const isCurrent = stepIndex === activeIndex;

  if (isCompleted) {
    return <CheckCircleIcon sx={{ color: "success.main", fontSize: 24 }} />;
  }
  if (isCurrent) {
    return <RadioButtonCheckedIcon sx={{ color: "primary.main", fontSize: 24 }} />;
  }
  return <RadioButtonUncheckedIcon sx={{ color: "grey.400", fontSize: 24 }} />;
}

export type OrderTimelineProps = {
  status: OrderStatus;
  /** Optional timestamps keyed by step. Display string (e.g. formatted date). */
  timestamps?: Partial<Record<TimelineStepKey, string>>;
};

export default function OrderTimeline({ status, timestamps }: OrderTimelineProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const rejected = isRejected(status);
  const activeIndex = rejected ? -1 : statusToStepIndex(status);

  if (rejected) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
        <CancelIcon sx={{ color: "error.main" }} />
        <Typography variant="body2" color="error.main" fontWeight={600}>
          Order Rejected — please contact support for assistance.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="body2" fontWeight={700}>
          Order Status
        </Typography>
        <Chip
          size="small"
          label={STEPS[activeIndex]?.label ?? String(status)}
          color={activeIndex === 3 ? "success" : "primary"}
          variant="filled"
          sx={{ fontWeight: 600 }}
        />
      </Box>

      {/* Stepper — horizontal on desktop, vertical on mobile */}
      <Stepper
        activeStep={activeIndex}
        orientation={isMobile ? "vertical" : "horizontal"}
        alternativeLabel={!isMobile}
        connector={isMobile ? undefined : <ColorConnector />}
        sx={{ px: isMobile ? 0 : 1 }}
      >
        {STEPS.map((step, idx) => {
          const isCompleted = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          const labelColor = isCompleted
            ? "success.main"
            : isCurrent
            ? "primary.main"
            : "text.disabled";

          return (
            <Step key={step.key} completed={isCompleted}>
              <StepLabel
                StepIconComponent={(iconProps) => (
                  <ColorStepIcon {...iconProps} activeIndex={activeIndex} stepIndex={idx} />
                )}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: labelColor,
                    fontWeight: isCurrent ? 700 : 500,
                    display: "block",
                    lineHeight: 1.4,
                  }}
                >
                  {step.label}
                </Typography>
                {timestamps?.[step.key] && (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block", lineHeight: 1.3 }}
                  >
                    {timestamps[step.key]}
                  </Typography>
                )}
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
