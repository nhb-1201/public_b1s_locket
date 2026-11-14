/* B1sTeam — chọn edge Worker ngẫu nhiên (phân bổ tải đều giữa các tài khoản Cloudflare) */
var B1S_FRAME_EDGES = [
  "https://locket-filter-frame.b1s-locket02-b1steam.workers.dev",
  "https://locket-filter-frame.b1steam-edge-03.workers.dev",
  "https://locket-filter-frame.beslin.workers.dev",
  "https://locket-filter-frame.b1steam-edge-05.workers.dev",
];
var B1S_GATEWAY_EDGES = [
  "https://b1steam-edge.b1s-locket02-b1steam.workers.dev",
  "https://b1steam-edge.b1steam-edge-03.workers.dev",
  "https://b1steam-edge.beslin.workers.dev",
  "https://b1steam-edge.b1steam-edge-05.workers.dev",
];
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function frameEdge() { return pickRandom(B1S_FRAME_EDGES); }
function gatewayEdge() { return pickRandom(B1S_GATEWAY_EDGES); }
