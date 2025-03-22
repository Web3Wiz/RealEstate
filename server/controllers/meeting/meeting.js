const MeetingHistory = require("../../model/schema/meeting");
const mongoose = require("mongoose");

const add = async (req, res) => {
  try {
    const {
      agenda,
      attendes,
      attendesLead,
      location,
      related,
      dateTime,
      notes,
      createBy,
    } = req.body;

    // Validate ObjectIds for attendees and lead attendees
    if (
      attendes &&
      !attendes.every((id) => mongoose.Types.ObjectId.isValid(id))
    ) {
      return res.status(400).json({ error: "Invalid attendes value" });
    }
    if (
      attendesLead &&
      !attendesLead.every((id) => mongoose.Types.ObjectId.isValid(id))
    ) {
      return res.status(400).json({ error: "Invalid attendesLead value" });
    }
    if (createBy && !mongoose.Types.ObjectId.isValid(createBy)) {
      return res.status(400).json({ error: "Invalid createBy value" });
    }

    const meetingData = {
      agenda,
      attendes,
      attendesLead,
      location,
      related,
      dateTime,
      notes,
      createBy,
    };

    const meeting = new MeetingHistory(meetingData);
    await meeting.save();
    res.status(200).json(meeting);
  } catch (err) {
    console.error("Failed to create meeting:", err);
    res.status(400).json({ error: "Failed to create meeting", details: err });
  }
};

const index = async (req, res) => {
  let query = req.query;
  query.deleted = false;
  if (query.createBy) {
    query.createBy = new mongoose.Types.ObjectId(query.createBy);
  }

  try {
    let result = await MeetingHistory.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "Contacts",
          localField: "attendes",
          foreignField: "_id",
          as: "contacts",
        },
      },
      {
        $lookup: {
          from: "Leads",
          localField: "attendesLead",
          foreignField: "_id",
          as: "leads",
        },
      },
      {
        $lookup: {
          from: "User",
          localField: "createBy",
          foreignField: "_id",
          as: "users",
        },
      },
      { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
      { $match: { "users.deleted": false } },
      {
        $addFields: {
          attendesNames: {
            $map: {
              input: "$contacts",
              as: "contact",
              in: {
                $concat: ["$$contact.title", " ", "$$contact.fullName"],
              },
            },
          },
          attendesLeadNames: {
            $map: {
              input: "$leads",
              as: "lead",
              in: "$$lead.leadName",
            },
          },
          createByName: "$users.username",
        },
      },
      { $project: { users: 0, contacts: 0, leads: 0 } },
    ]);

    res.send(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

const view = async (req, res) => {
  try {
    let response = await MeetingHistory.findOne({ _id: req.params.id });
    if (!response) return res.status(404).json({ message: "No Data Found." });

    let result = await MeetingHistory.aggregate([
      { $match: { _id: response._id } },
      {
        $lookup: {
          from: "Contacts",
          localField: "attendes",
          foreignField: "_id",
          as: "contacts",
        },
      },
      {
        $lookup: {
          from: "Leads",
          localField: "attendesLead",
          foreignField: "_id",
          as: "leads",
        },
      },
      {
        $lookup: {
          from: "User",
          localField: "createBy",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          attendesNames: {
            $map: {
              input: "$contacts",
              as: "contact",
              in: {
                fullName: "$$contact.fullName",
                _id: "$$contact._id",
              },
            },
          },
          attendesLeadNames: {
            $map: {
              input: "$leads",
              as: "lead",
              in: "$$lead.leadName",
            },
          },
          createByName: "$creator.username",
        },
      },
      { $project: { contacts: 0, leads: 0, creator: 0 } },
    ]);

    res.status(200).json(result[0]);
  } catch (err) {
    console.error("Error:", err);
    res.status(400).json({ error: err });
  }
};

const deleteData = async (req, res) => {
  try {
    const result = await MeetingHistory.findByIdAndUpdate(req.params.id, {
      deleted: true,
    });
    res.status(200).json({ message: "done", result });
  } catch (err) {
    res.status(404).json({ message: "error", err });
  }
};

const deleteMany = async (req, res) => {
  try {
    const result = await MeetingHistory.updateMany(
      { _id: { $in: req.body } },
      { $set: { deleted: true } }
    );

    if (result?.matchedCount > 0 && result?.modifiedCount > 0) {
      return res
        .status(200)
        .json({ message: "Meetings removed successfully", result });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Failed to remove meetings" });
    }
  } catch (err) {
    return res.status(404).json({ success: false, message: "error", err });
  }
};

module.exports = { add, index, view, deleteData, deleteMany };
