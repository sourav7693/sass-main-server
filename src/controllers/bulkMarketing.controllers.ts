import axios from "axios";
import { Request, Response } from "express";

export async function getAllTemplates(req: Request, res: Response) {
  try {
    const payload = {
      "auth-key": process.env.WA_AUTH_KEY,
      "app-key": process.env.WA_APP_KEY,
      device_id: process.env.WA_DEVICE_ID,
      limit: 100,
    };
    const { data, status } = await axios.post(
      "https://web.wabridge.com/api/gettemplate",
      payload,
    );
    if (status !== 201) {
      throw Error;
    }
    res.status(200).json({ templates: data.data });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
}
