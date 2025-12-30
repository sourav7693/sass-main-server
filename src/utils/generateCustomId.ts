import { Model, Document } from "mongoose";

interface TimePrefixOptions {
  enable?: boolean;
}

export async function generateCustomId<T extends Document>(
  Model: Model<T>,
  idField: string,
  prefix: string,
  options?: TimePrefixOptions
): Promise<string> {
  let finalPrefix = prefix;

    if (options?.enable) {
      const now = new Date();

      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yy = String(now.getFullYear()).slice(-2);
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");

      finalPrefix = `${prefix}${dd}${mm}${yy}${hh}${min}`;
    }
  try {
    // Fetch records and extract the relevant ID field (e.g., userId) sorted by idField
    const records = await Model.find(
      { [idField]: { $regex: `^${prefix}` } },
      { [idField]: 1, _id: 0 }
    ).sort({
      [idField]: 1,
    });

    // Extract numeric parts from the idField, ignoring the prefix
    const ids = records
      .map((record) => {
        if (idField in record) {
          const raw = record[idField as keyof T] as string;
          const num = raw.replace(finalPrefix, "");
          return parseInt(num, 10);
        }
        return null;
      })
      .filter((id): id is number => id !== null);

    // Start generating the new ID, ensuring it does not conflict with existing IDs
    let newId = 1;
    for (let i = 0; i < ids.length; i++) {
      if (newId < (ids[i] ?? Infinity)) {
        break;
      }
      newId++;
    }

    // Return the new ID formatted with the prefix and zero-padded
    return `${finalPrefix}${String(newId).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating custom ID:", error);
    throw new Error("Unable to generate custom ID");
  }
}
