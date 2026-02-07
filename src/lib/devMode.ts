export const isDevMode = (): boolean => {
  return import.meta.env.VITE_DEV_MODE === "true";
};
