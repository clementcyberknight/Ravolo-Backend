export type HarvestCommand = {
  plotId: number;
  requestId: string;
};

export type ClearPlotWitherCommand = {
  plotId: number;
  requestId: string;
};

export type HarvestResult =
  | {
      kind: "harvest";
      /** Inventory field credited (e.g. wheat, cocoa_pods). */
      itemId: string;
      quantity: number;
      idempotentReplay?: boolean;
    }
  | {
      kind: "withered_harvest";
      itemId: string;
      quantity: 0;
      idempotentReplay?: boolean;
    };

export type ClearPlotWitherResult = { ok: true; idempotentReplay?: boolean };
