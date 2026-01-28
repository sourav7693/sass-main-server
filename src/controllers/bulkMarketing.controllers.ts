import axios from "axios";
import { Request, Response } from "express";
import cron from "node-cron";
import Campaign from "../models/Campaign";
import mongoose from "mongoose";

function formatMobile(mobile: string) {
  // Remove all non-numeric characters
  let formatted = mobile.replace(/\D/g, "");

  // Remove leading 0 if present
  if (formatted.startsWith("0")) {
    formatted = formatted.substring(1);
  }

  // Add country code if not present (assuming India: 91)
  if (!formatted.startsWith("91") && formatted.length === 10) {
    formatted = `91${formatted}`;
  }

  return formatted;
}

async function sendWhatsAppMessage(
  destinationNumber: string,
  templateId: string,
  variables = [],
) {
  try {
    const payload = {
      "auth-key": process.env.WA_AUTH_KEY,
      "app-key": process.env.WA_APP_KEY,
      destination_number: formatMobile(destinationNumber),
      template_id: templateId,
      device_id: process.env.WA_DEVICE_ID,
      language: "en",
      variables: variables,
    };

    const response = await axios.post(
      "https://web.wabridge.com/api/createmessage",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return {
      success: true,
      messageId: response.data?.messageId || null,
      response: response.data,
    };
  } catch (error: any) {
    console.error(
      "Error sending WhatsApp message:",
      error.response?.data || error.message,
    );
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

async function processCampaign(campaignId: string) {
  try {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign || campaign.status === "completed") {
      return;
    }

    // Update campaign status
    campaign.status = "processing";
    campaign.startedAt = new Date();
    await campaign.save();

    // Process customers in batches to avoid rate limiting
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < campaign.scheduledCustomers.length; i += batchSize) {
      batches.push(campaign.scheduledCustomers.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failureCount = 0;

    // Process each batch
    for (const batch of batches) {
      const promises = batch.map(
        async (customerData: {
          customerId: Types.ObjectId;
          mobile: string;
          name: string;
          status: string;
          sentAt: Date;
          messageId: string;
          error: string;
        }) => {
          try {
            const result = await sendWhatsAppMessage(
              customerData.mobile,
              campaign.templateId,
              campaign.parametersArray,
            );

            if (result.success) {
              customerData.status = "sent";
              customerData.sentAt = new Date();
              customerData.messageId = result.messageId;
              successCount++;
            } else {
              customerData.status = "failed";
              customerData.error = result.error;
              failureCount++;
            }
          } catch (error: any) {
            customerData.status = "failed";
            customerData.error = error.message;
            failureCount++;
          }

          return customerData;
        },
      );

      await Promise.all(promises);

      // Update campaign progress
      campaign.successCount = successCount;
      campaign.failureCount = failureCount;
      campaign.processedCount = successCount + failureCount;
      await campaign.save();

      // Delay between batches (5 seconds to avoid rate limiting)
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Mark campaign as completed
    campaign.status = "completed";
    campaign.completedAt = new Date();
    await campaign.save();

    console.log(
      `Campaign ${campaignId} completed: ${successCount} sent, ${failureCount} failed`,
    );
  } catch (error: any) {
    console.error(`Error processing campaign ${campaignId}:`, error);

    // Update campaign status to failed
    await Campaign.findByIdAndUpdate(campaignId, {
      status: "failed",
      error: error.message,
    });
  }
}

async function initializeScheduler() {
  // Run every minute to check for scheduled campaigns
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // Find campaigns scheduled for now or earlier
      const scheduledCampaigns = await Campaign.find({
        status: "scheduled",
        scheduledFor: { $lte: now },
      });

      for (const campaign of scheduledCampaigns) {
        console.log(`Processing scheduled campaign: ${campaign._id}`);
        await processCampaign(campaign._id);
      }
    } catch (error) {
      console.error("Error processing scheduled campaigns:", error);
    }
  });
  console.log("Campaign scheduler initialized");
}

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

export async function createCampaign(req: Request, res: Response) {
  try {
    const {
      templateId,
      templateName,
      customerType,
      mobileNumbers, // New field
      parameters,
      parametersArray,
      sendImmediately,
      scheduleDate,
      scheduleTime,
      scheduledDateTime,
    } = req.body;

    // Validate required fields
    if (!templateId || !templateName) {
      return res.status(400).json({
        success: false,
        message: "Template ID and template name are required",
      });
    }

    // Validate either customerType or mobileNumbers must be provided
    if (!customerType && (!mobileNumbers || mobileNumbers.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Either select customer filter or enter mobile numbers",
      });
    }

    let customers = [];

    // Handle mobile numbers input
    if (mobileNumbers && mobileNumbers.length > 0) {
      // Create customer objects from mobile numbers
      customers = mobileNumbers.map((mobile: string, index: number) => ({
        _id: new mongoose.Types.ObjectId(), // Generate unique ID
        mobile: mobile,
        name: `Recipient ${index + 1}`,
      }));
    }

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No recipients found",
      });
    }

    // Prepare campaign data
    const campaignData: any = {
      templateId,
      templateName,
      customerType: mobileNumbers ? "manual" : customerType,
      mobileNumbers: mobileNumbers || [],
      parameters,
      parametersArray,
      totalCustomers: customers.length,
      scheduledCustomers: customers.map((customer) => ({
        customerId: customer._id,
        mobile: customer.mobile,
        name: customer.name || `Recipient`,
        status: "pending",
        sentAt: null,
      })),
    };

    // Set schedule if provided
    if (!sendImmediately && scheduledDateTime) {
      campaignData.scheduledFor = new Date(scheduledDateTime);
      campaignData.status = "scheduled";
      campaignData.sendImmediately = false;
    } else {
      campaignData.status = "processing";
      campaignData.sendImmediately = true;
      campaignData.scheduledFor = null;
    }

    // Create campaign in database
    const campaign = await Campaign.create(campaignData);

    // If immediate send, start processing
    if (sendImmediately) {
      await processCampaign(campaign._id);
    }

    return res.status(201).json({
      success: true,
      message: sendImmediately
        ? "Campaign created and processing started"
        : "Campaign scheduled successfully",
      data: {
        campaignId: campaign._id,
        totalCustomers: customers.length,
        scheduledFor: campaign.scheduledFor,
        status: campaign.status,
      },
    });
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create campaign",
      error: error.message,
    });
  }
}
