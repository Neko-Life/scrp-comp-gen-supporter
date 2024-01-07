import { Protocol } from "puppeteer";

// you should login to the site, preferably with new google acc or smt:
// https://finder.startupnationcentral.org/startups/search?&primarysectorclassification=agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4IfeyLoKDA
// and copy all the site cookies after u login and format it to populate below constant

export const COOKIES: Protocol.Network.CookieParam[] = [
  {
    name: "__Secure-3PAPISID",
    value: "",
    domain: ".google.co.id",
    path: "/",
    expires: new Date("2025-02-10T02:02:09.627Z").valueOf(),
    secure: true,
    sameSite: "None",
    priority: "High",
  },
  // etc etc more cookies
];
