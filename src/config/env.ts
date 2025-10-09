type Env = {
  PORT: number;
};

export const env: Env = {
  PORT: Number(process.env.PORT) || 3338
};
