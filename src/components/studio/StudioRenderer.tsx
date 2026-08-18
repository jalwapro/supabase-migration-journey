import React from "react";
import { Link } from "@tanstack/react-router";
import type { AppComponentNode } from "@/lib/app-customization/schema";

function styleOf(node: AppComponentNode): React.CSSProperties {
  return { ...(node.style ?? {}) } as React.CSSProperties;
}

export function StudioRenderer({ component, interactive = true }: { component: AppComponentNode; interactive?: boolean }) {
  if (!component || component.visible === false) return null;
  const style = styleOf(component);
  const label = String(component.props?.label ?? component.name ?? "");
  const image = typeof component.props?.src === "string" ? component.props.src : typeof component.props?.imageUrl === "string" ? component.props.imageUrl : null;
  const children = component.children?.map((child) => <StudioRenderer key={child.id} component={child} interactive={interactive} />);
  const action = component.action;
  if (component.type === "image" && image) return <img src={image} alt={String(component.props?.alt ?? "")} className="max-w-full object-cover" style={style} />;
  if (component.type === "avatar" && image) return <img src={image} alt="" className="rounded-full object-cover" style={style} />;

  const className = [
    component.type === "heading" ? "text-xl font-bold" : "",
    component.type === "text" ? "text-sm" : "",
    component.type === "button" || component.type.endsWith("-button") ? "inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" : "",
    component.type === "card" || component.type.endsWith("-card") ? "rounded-2xl border border-border bg-card p-4" : "",
    component.type === "banner" ? "rounded-2xl p-4" : "",
  ].filter(Boolean).join(" ");
  const body = <div className={className} style={style}>{children ?? label}</div>;
  if (!interactive || !action) return body;
  if (action.type === "navigate" && action.value?.startsWith("/")) return <Link to={action.value as never}>{body}</Link>;
  if (action.type === "open-url" && action.value) return <a href={action.value} target="_blank" rel="noreferrer">{body}</a>;
  return body;
}
