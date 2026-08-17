import { createServerFn } from "@tanstack/react-start";

export const getAppConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      studioConfig: null
    };
  });

export const useAppConfig = () => {
  return {
    studioConfig: {
      root: {
        children: []
      }
    }
  };
};
