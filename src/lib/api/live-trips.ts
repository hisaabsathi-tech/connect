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
  lastPoint: LiveTripPoint | null;
  orders: LiveTripOrder[];
};

const LIVE_TRIPS_QUERY = `
query LiveVehicleTrips {
  liveVehicleTrips {
    id drsId drsStatus vehicleId vehicleNo deliveryBoyId deliveryBoyName startedAt mine
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

/** Path the vehicle has driven so far, oldest first (the trip map's trail). */
export async function fetchTripPath(token: string, drsId: string): Promise<LiveTripPoint[]> {
  const { vehicleTracking } = await graphqlRequest<{
    vehicleTracking: { items: LiveTripPoint[] };
  }>({
    query: `query TripPath($drsId: String) {
      vehicleTracking(drsId: $drsId limit: 2000) { items { latitude longitude recordedAt } }
    }`,
    token,
    variables: { drsId },
  });
  return vehicleTracking.items;
}
