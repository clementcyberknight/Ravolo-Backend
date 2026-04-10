export type BuyPlotCommand = {
  requestId: string;
};

export type BuyPlotResult = {
  plotId: number;
  goldSpent: number;
  totalOwnedPlots: number;
};

export type GameStatusPlotsData = {
  starterPlots: number;
  starterPlotIds: number[];
  purchasable: boolean;
  maxPlots: number;
  purchaseBaseGold: number;
  purchaseStepGold: number;
  pricingFormula: string;
  loanCollateralValueGold: number;
  note: string;
};

/** Normalised plot row for GAME_STATE, GET_PLOT_STATE, etc. */
export type PlotStateItem = {
  plotId: number;
  cropId: string | null;
  plantedAtMs: number | null;
  readyAtMs: number | null;
  msUntilReady: number | null;
  status: "empty" | "growing" | "ready" | "withered";
  wither: boolean;
  /** Present when a crop is planted (from plot hash). */
  outputQty: number | null;
  harvestItem: string | null;
};
