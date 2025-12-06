import type { Request, Response } from "express";
import { Pickup, type PickupDoc } from "../models/Pickup.js";
import { generateCustomId } from "../utils/generateCustomId.js";

export const createPickup = async (req : Request, res: Response) => {
    try {
        const { name, address, pin, mobile } = req.body;
        const pickupId = await generateCustomId(Pickup, "pickupId", "PICK");
        const pickup = await Pickup.create({pickupId, name, address, pin, mobile });
        res.status(201).json(pickup);
    } catch (error) {
        res
            .status(500)
            .json(error instanceof Error ? error.message : "Internal Server Error");
    }
};

export const getPickups = async (req: Request, res: Response) => {
    try {
         const page = Number(req.query.page) || 1;
         const limit = req.query.limit ? Number(req.query.limit) : 10;
            const total = await Pickup.countDocuments();
             const sort = req.query.sort ? String(req.query.sort) : "desc";
    const sortOrder = sort === "asc" ? 1 : -1;
            
            const pickups = await Pickup.find()
            .sort({ createdAt: sortOrder })
                   .skip((page - 1) * limit)
                   .limit(limit)
                   .lean<PickupDoc[]>();

            return res.json({
                success: true,
                page,
                total,
                pages: Math.ceil(total / limit),
                pickups,
            });
    } catch (error) {
        res.status(500).json({
          message: "Something went wrong",
          success: false,
          page: 0,
          total: 0,
          pages: 0,
        });
    }
};

export const updatePickup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, address, pin, mobile, status } = req.body;

        const pickup = await Pickup.findOne({ pickupId: id });
        if (!pickup) {
            return res.status(404).json({ message: "Pickup not found" });
        }

        if (name !== undefined) pickup.name = name;
        if (address !== undefined) pickup.address = address;
        if (pin !== undefined) pickup.pin = pin;
        if (mobile !== undefined) pickup.mobile = mobile;
        if (status !== undefined) pickup.status = status;

        await pickup.save();
        res.status(200).json(pickup);
    } catch (error) {
        res
            .status(500)
            .json(error instanceof Error ? error.message : "Internal Server Error");
    }
};

export const deletePickup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const pickup = await Pickup.findOne({ pickupId: id });
        if (!pickup) {
            return res.status(404).json({ message: "Pickup not found" });
        }

        await Pickup.findOneAndDelete({ pickupId: id });
        res.status(200).json({ message: "Pickup deleted" });
    } catch (error) {
        res
            .status(500)
            .json(error instanceof Error ? error.message : "Internal Server Error");
    }
};