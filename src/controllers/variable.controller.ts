import type { Request, Response } from "express";
import { Variable, type VariableDoc } from "../models/Variables.js";
import { generateCustomId } from "../utils/generateCustomId.js";

export const createVariable = async (req: Request, res: Response) => {
  try {
    const { name, value } = req.body;

    const variableId = await generateCustomId(Variable, "variableId", "VAR");

    const variable = await Variable.create({
      variableId,
      name,
      value,
    });
    res.status(201).json(variable);
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};

export const getVariables = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const total = await Variable.countDocuments();

    const variables = await Variable.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<VariableDoc[]>();

    return res.json({
      success: true,
      page,
      total,
      pages: Math.ceil(total / limit),
      variables,
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

export const updateVariable = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, value, status } = req.body;

    const variable = await Variable.findOne({ variableId: id });
    if (!variable) {
      return res.status(404).json({ message: "Variable not found" });
    }

    
    if (name !== undefined) variable.name = name;
    if (value !== undefined) variable.value = value;
    if (status !== undefined) variable.status = status;

    await variable.save();
    res.status(200).json(variable);
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};

export const deleteVariable = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const variable = await Variable.findOne({ variableId: id });
    if (!variable) {
      return res.status(404).json({ message: "Variable not found" });
    }

    await Variable.findOneAndDelete({ variableId: id });
    res.status(200).json({ message: "Variable deleted" });
  } catch (error) {
    res
      .status(500)
      .json(error instanceof Error ? error.message : "Internal Server Error");
  }
};
