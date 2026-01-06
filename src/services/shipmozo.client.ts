import axios from "axios";

export const shipmozoClient = axios.create({
  baseURL: "https://shipping-api.com/app/api/v1",
  headers: {
    "Content-Type": "application/json",
    "public-key": process.env.SHIPMOZO_PUBLIC_KEY!,
    "private-key": process.env.SHIPMOZO_PRIVATE_KEY!,
  },
});
