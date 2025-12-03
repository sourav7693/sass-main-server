import { Model, Document } from "mongoose";

export async function generateCustomId<T extends Document>(
  Model: Model<T>,
  idField: string,
  prefix: string
): Promise<string> {
  try {
    // Fetch records and extract the relevant ID field (e.g., userId) sorted by idField
    const records = await Model.find({}, { [idField]: 1, _id: 0 }).sort({
      [idField]: 1,
    });

    // Extract numeric parts from the idField, ignoring the prefix
    const ids = records
      .map((record) => {
        // Check if idField exists on the record object
        if (idField in record) {
          return parseInt(
            (record[idField as keyof T] as string).replace(prefix, ""),
            10
          );
        }
        return null;
      })
      .filter((id) => id !== null);

    // Start generating the new ID, ensuring it does not conflict with existing IDs
    let newId = 1;
    for (let i = 0; i < ids.length; i++) {
      if (newId < (ids[i] ?? Infinity)) {
        break;
      }
      newId++;
    }

    // Return the new ID formatted with the prefix and zero-padded
    return `${prefix}${String(newId).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating custom ID:", error);
    throw new Error("Unable to generate custom ID");
  }
}
