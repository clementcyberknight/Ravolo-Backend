import type { Redis } from "ioredis";
import { ownedPlotsKey, plotKey } from "../../infrastructure/redis/keys.js";
import type { PlotStateItem } from "./farm.types.js";

/**
 * Loads all owned plots for `userId` and returns stable, UI-ready plot rows
 * (same rules as GAME_STATE plots).
 */
export async function buildPlotsState(
  redis: Redis,
  userId: string,
  nowMs: number,
): Promise<PlotStateItem[]> {
  const plotIds = await redis.smembers(ownedPlotsKey(userId));

  const plots = await Promise.all(
    plotIds.map(async (id) => {
      const state = await redis.hgetall(plotKey(userId, Number(id)));
      if (state.wither === "1") {
        return {
          plotId: Number(id),
          cropId: null,
          plantedAtMs: null,
          readyAtMs: null,
          msUntilReady: null,
          status: "withered" as const,
          wither: true,
          outputQty: null,
          harvestItem: null,
        } satisfies PlotStateItem;
      }

      const readyAtMs = Number(state.readyAt ?? state.readyAtMs ?? 0);
      const plantedAtMs = Number(state.plantedAt ?? state.plantedAtMs ?? 0);
      const outputRaw = state.outputQty;
      const outParsed =
        outputRaw !== undefined && outputRaw !== ""
          ? Number(outputRaw)
          : NaN;
      const outQty =
        state.cropId &&
        Number.isFinite(outParsed) &&
        outParsed >= 0
          ? Math.floor(outParsed)
          : null;
      const harvestItem =
        typeof state.harvestItem === "string" && state.harvestItem !== ""
          ? state.harvestItem
          : null;

      let status: "empty" | "growing" | "ready";
      if (!state.cropId) {
        status = "empty";
      } else if (readyAtMs > 0 && nowMs >= readyAtMs) {
        status = "ready";
      } else {
        status = "growing";
      }

      return {
        plotId: Number(id),
        cropId: state.cropId ?? null,
        plantedAtMs: plantedAtMs || null,
        readyAtMs: readyAtMs || null,
        msUntilReady:
          status === "growing" ? Math.max(0, readyAtMs - nowMs) : null,
        status,
        wither: false,
        outputQty: state.cropId ? outQty : null,
        harvestItem: state.cropId ? harvestItem : null,
      } satisfies PlotStateItem;
    }),
  );

  plots.sort((a, b) => a.plotId - b.plotId);
  return plots;
}
