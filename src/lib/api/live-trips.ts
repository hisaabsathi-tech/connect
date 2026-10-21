import { graphqlRequest } from "@/lib/api/graphql";

/** One order still to reach on a live trip, and the road distance left to it. */
export type LiveTripOrder = {
  orderId: string;
  awbNo: string;
  receiverName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Null until the vehicle has reported a position (or the address couldn't be placed). */
  remainingMeters: number | null;
  totalMeters: number | null;
  /** 0–1 share of the way already covered. */
  progress: number | null;
  /** A straight-line estimate rather than the road route. */
  estimated: boolean;
};

export type LiveTripPoint = { latitude: number; longitude: number; recordedAt: string };

/** An open live vehicle trip: a DRS out for delivery with live tracking on. */
export type LiveTrip = {
  id: string;
  drsId: string | null;
  drsStatus: string | null;
  vehicleId: string;
  vehicleNo: string | null;
  deliveryBoyId: string;
  deliveryBoyName: string | null;
  startedAt: string;
  /** This phone's user is the one driving it. */
  mine: boolean;
  /** "2", "3" or "4" wheels; picks how the vehicle is drawn (config/vehicle-pins). */
  vehicleWheelCount: string | null;
  /** The trip's earliest GPS fix (the Start pin); null until the first one is stored. */
  startPoint?: LiveTripPoint | null;
  lastPoint: LiveTripPoint | null;
  orders: LiveTripOrder[];
};

const LIVE_TRIPS_QUERY = `
query LiveVehicleTrips {
  liveVehicleTrips {
    id drsId drsStatus vehicleId vehicleNo vehicleWheelCount deliveryBoyId deliveryBoyName
    startedAt mine
    startPoint { latitude longitude recordedAt }
    lastPoint { latitude longitude recordedAt }
    orders {
      orderId awbNo receiverName address latitude longitude
      remainingMeters totalMeters progress estimated
    }
  }
}`;

/**
 * Open live trips this member may watch: every trip in the organisation for a role with order
 * view, otherwise only the ones they drive.
 */
export async function fetchLiveTrips(token: string): Promise<LiveTrip[]> {
  const { liveVehicleTrips } = await graphqlRequest<{ liveVehicleTrips: LiveTrip[] }>({
    query: LIVE_TRIPS_QUERY,
    token,
  });
  return liveVehicleTrips;
}

/** A stored GPS point of a trip; `id` is stable, so a resend or replay is merged, not doubled. */
export type TripPathPoint = LiveTripPoint & { id: string };

const PATH_PAGE = 2000;
/** 50 000 points: far beyond a day's driving at the phone's sampling rate. */
const PATH_MAX_PAGES = 25;

/** Path the vehicle has driven so far, oldest first (the trip map's trail), every page of it. */
export async function fetchTripPath(token: string, drsId: string): Promise<TripPathPoint[]> {
  const points: TripPathPoint[] = [];
  for (let page = 0; page < PATH_MAX_PAGES; page += 1) {
    const { vehicleTracking } = await graphqlRequest<{
      vehicleTracking: { items: TripPathPoint[]; pagination: { total: number } };
    }>({
      query: `query TripPath($drsId: String, $limit: Int, $offset: Int) {
        vehicleTracking(drsId: $drsId, limit: $limit, offset: $offset) {
          items { id latitude longitude recordedAt }
          pagination { total }
        }
      }`,
      token,
      variables: { drsId, limit: PATH_PAGE, offset: page * PATH_PAGE },
    });
    points.push(...vehicleTracking.items);
    const done =
      vehicleTracking.items.length < PATH_PAGE || points.length >= vehicleTracking.pagination.total;
    if (done) break;
  }
  return mergeTripPath([], points);
}

/** Merges by point id, oldest first (points with the same time keep their arrival order). */
export function mergeTripPath(
  current: readonly TripPathPoint[],
  incoming: readonly TripPathPoint[],
): TripPathPoint[] {
  const byId = new Map<string, TripPathPoint>();
  for (const point of current) byId.set(point.id, point);
  for (const point of incoming) byId.set(point.id, point);
  return [...byId.values()]
    .map((point, index) => ({ index, point }))
    .sort(
      (a, b) =>
        Date.parse(a.point.recordedAt) - Date.parse(b.point.recordedAt) || a.index - b.index,
    )
    .map(({ point }) => point);
}
