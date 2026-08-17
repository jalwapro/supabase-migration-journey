import React from "react";

export const StudioRenderer = ({ component }: { component: any }) => {
  if (!component) return null;
  return <div>Studio Component</div>;
};
