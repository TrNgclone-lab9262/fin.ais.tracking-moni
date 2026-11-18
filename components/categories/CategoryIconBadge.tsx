"use client";

import React from "react";
import {
  Award,
  Baby,
  Briefcase,
  Car,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  PiggyBank,
  Plane,
  ShoppingBag,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Utensils,
  Home,
  Car,
  ShoppingBag,
  HeartPulse,
  Zap,
  Film,
  Baby,
  Dog,
  Coffee,
  GraduationCap,
  Plane,
  Gift,
  Wrench,
  Dumbbell,
  Briefcase,
  Laptop,
  Award,
  TrendingUp,
  Wallet,
  PiggyBank,
  MoreHorizontal,
};

interface CategoryIconBadgeProps {
  iconName?: string;
  color: string;
  size?: "sm" | "md";
}

export function CategoryGlyph({
  iconName,
  className = "w-4 h-4",
  style,
}: {
  iconName?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const IconComp = (iconName && ICON_COMPONENTS[iconName]) || Tag;
  return <IconComp className={className} style={style} />;
}

export function CategoryIconBadge({
  iconName,
  color,
  size = "md",
}: CategoryIconBadgeProps) {
  const boxClass = size === "sm" ? "w-7 h-7 rounded-lg" : "w-9 h-9 rounded-lg";
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div
      className={`${boxClass} flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10`}
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <CategoryGlyph iconName={iconName} className={iconClass} />
    </div>
  );
}
