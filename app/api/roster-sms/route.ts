import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const africasTalkingUsername =
  process.env.AFRICASTALKING_USERNAME!;

const africasTalkingApiKey =
  process.env.AFRICASTALKING_API_KEY!;

function getAdminClient() {
  return createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function isValidRwandaPhone(phone: string) {
  return /^\+2507\d{8}$/.test(phone);
}

export async function POST(
  request: NextRequest
) {
  try {
    // 1. Verify the logged-in user
    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error: "Not authenticated.",
        },
        {
          status: 401,
        }
      );
    }

    const token = authorization.replace(
      "Bearer ",
      ""
    );

    const adminClient = getAdminClient();

    const {
      data: { user: currentUser },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !currentUser) {
      return NextResponse.json(
        {
          error: "Invalid login session.",
        },
        {
          status: 401,
        }
      );
    }

    // 2. Only an active administrator
    // with an organization can send roster SMS.
    const {
      data: currentProfile,
      error: currentProfileError,
    } = await adminClient
      .from("profiles")
      .select(
        "id, role, active, organization_id"
      )
      .eq("id", currentUser.id)
      .single();

    if (
      currentProfileError ||
      !currentProfile ||
      currentProfile.role !== "admin" ||
      !currentProfile.active ||
      !currentProfile.organization_id
    ) {
      return NextResponse.json(
        {
          error:
            "Administrator access is required.",
        },
        {
          status: 403,
        }
      );
    }

    // 3. Read the requested notification
    const body = await request.json();

    const userId = String(
      body.userId || ""
    ).trim();

    const action = String(
      body.action || ""
    ).trim();

    const shiftDate = String(
      body.shiftDate || ""
    ).trim();

    const shift = String(
      body.shift || ""
    )
      .trim()
      .toLowerCase();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Staff user ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !== "assigned" &&
      action !== "removed"
    ) {
      return NextResponse.json(
        {
          error: "Invalid SMS action.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      shift !== "day" &&
      shift !== "night"
    ) {
      return NextResponse.json(
        {
          error: "Invalid shift.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        shiftDate
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid shift date.",
        },
        {
          status: 400,
        }
      );
    }

    // 4. Get the staff member.
    //
    // IMPORTANT:
    // This endpoint uses the Supabase service role,
    // so RLS is bypassed here.
    //
    // We therefore explicitly require the staff
    // member to belong to the SAME organization
    // as the logged-in administrator.
    const {
      data: staffProfile,
      error: staffError,
    } = await adminClient
      .from("profiles")
      .select(
        "id, full_name, phone_number, active, organization_id"
      )
      .eq("id", userId)
      .eq(
        "organization_id",
        currentProfile.organization_id
      )
      .single();

    if (
      staffError ||
      !staffProfile
    ) {
      return NextResponse.json(
        {
          error:
            "Staff member not found in your organization.",
        },
        {
          status: 404,
        }
      );
    }

    if (!staffProfile.active) {
      return NextResponse.json(
        {
          error:
            "This staff member is inactive.",
        },
        {
          status: 400,
        }
      );
    }

    const phoneNumber = String(
      staffProfile.phone_number || ""
    ).trim();

    if (!phoneNumber) {
      return NextResponse.json(
        {
          error:
            "This staff member does not have a phone number.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidRwandaPhone(phoneNumber)) {
      return NextResponse.json(
        {
          error:
            "The staff phone number is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    // 5. Format date for the SMS
    const [year, month, day] =
      shiftDate.split("-");

    const displayDate =
      `${day}/${month}/${year}`;

    const shiftName =
      shift === "day"
        ? "DAY"
        : "NIGHT";

    const staffName =
      staffProfile.full_name ||
      "Staff member";

    let message = "";

    if (action === "assigned") {
      message =
        `Healthy HomeCare: ${staffName}, ` +
        `you have been assigned to the ` +
        `${shiftName} shift on ${displayDate}.`;
    } else {
      message =
        `Healthy HomeCare: ${staffName}, ` +
        `your ${shiftName} shift on ` +
        `${displayDate} has been removed or changed.`;
    }

    // 6. In Sandbox, redirect messages
    // to the simulator number.
    const sandboxTestNumber =
      process.env.AFRICASTALKING_TEST_TO;

    const destination =
      africasTalkingUsername === "sandbox" &&
      sandboxTestNumber
        ? sandboxTestNumber
        : phoneNumber;

    // 7. Send through Africa's Talking
    const smsBody =
      new URLSearchParams();

    smsBody.append(
      "username",
      africasTalkingUsername
    );

    smsBody.append(
      "to",
      destination
    );

    smsBody.append(
      "message",
      message
    );

    const smsResponse = await fetch(
      africasTalkingUsername === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          apiKey: africasTalkingApiKey,
          Accept: "application/json",
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: smsBody.toString(),
      }
    );

    const smsResult =
      await smsResponse.json();

    if (!smsResponse.ok) {
      console.error(
        "Africa's Talking SMS error:",
        smsResult
      );

      return NextResponse.json(
        {
          error:
            "The SMS provider could not send the message.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Roster SMS sent successfully.",
    });
  } catch (error) {
    console.error(
      "Roster SMS error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not send roster SMS.",
      },
      {
        status: 500,
      }
    );
  }
}