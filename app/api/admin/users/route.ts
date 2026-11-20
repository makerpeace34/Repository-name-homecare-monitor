import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseServiceKey =

  process.env.SUPABASE_SERVICE_ROLE_KEY!;



function getAdminClient() {

  return createClient(supabaseUrl, supabaseServiceKey, {

    auth: {

      autoRefreshToken: false,

      persistSession: false,

    },

  });

}



function isValidRwandaPhone(phoneNumber: string) {
  return /^\+2507\d{8}$/.test(phoneNumber);
}

async function verifyAdministrator(request: NextRequest) {

  const authorization =

    request.headers.get("authorization");



  if (

    !authorization ||

    !authorization.startsWith("Bearer ")

  ) {

    return {

      error: "Not authenticated.",

      status: 401,

    };

  }



  const token = authorization.replace("Bearer ", "");

  const adminClient = getAdminClient();



  const {

    data: { user },

    error: userError,

  } = await adminClient.auth.getUser(token);



  if (userError || !user) {

    return {

      error: "Invalid login session.",

      status: 401,

    };

  }



  const { data: profile, error: profileError } =

    await adminClient

      .from("profiles")

      .select(

        "id, full_name, role, active, organization_id"

      )

      .eq("id", user.id)

      .single();



  if (

    profileError ||

    !profile ||

    profile.role !== "admin" ||

    !profile.active ||

    !profile.organization_id

  ) {

    return {

      error: "Administrator access is required.",

      status: 403,

    };

  }



  return {

    user,

    adminClient,

    profile,

  };

}



export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Users API configuration missing: Supabase environment variable");
      return NextResponse.json(
        { error: "Users service is not configured. Check server environment variables." },
        { status: 500 }
      );
    }

    const verification = await verifyAdministrator(request);
    if ("error" in verification) {
      return NextResponse.json(
        { error: verification.error },
        { status: verification.status }
      );
    }

    const { adminClient, profile: currentAdminProfile } = verification;

    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, full_name, phone_number, role, active, created_at, organization_id")
      .eq("organization_id", currentAdminProfile.organization_id);

    if (profilesError) {
      console.error("Users API profiles query failed:", profilesError);
      return NextResponse.json(
        { error: "Could not load organization profiles. Check server logs (profiles query)." },
        { status: 500 }
      );
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) {
      console.error("Users API Supabase Auth listUsers failed:", authError);
      return NextResponse.json(
        { error: "Could not load authentication users. Check server logs (Auth listUsers)." },
        { status: 500 }
      );
    }

    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const users = (authData?.users || [])
      .filter((authUser) => profileById.has(authUser.id))
      .map((authUser) => {
        const profile = profileById.get(authUser.id);
        return {
          id: authUser.id,
          email: authUser.email || "",
          fullName: profile?.full_name || "",
          phoneNumber: profile?.phone_number || "",
          role: profile?.role || "caregiver",
          active: profile?.active ?? true,
          createdAt: profile?.created_at || authUser.created_at,
        };
      });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Users API GET unexpected error:", error);
    return NextResponse.json(
      { error: "Users service encountered an unexpected error. Check the server logs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  const verification =

    await verifyAdministrator(request);



  if ("error" in verification) {

    return NextResponse.json(

      {

        error: verification.error,

      },

      {

        status: verification.status,

      }

    );

  }



  const {

    adminClient,

    user: currentAdmin,

    profile: currentAdminProfile,

  } = verification;



  try {

    const body = await request.json();



    const fullName = String(

      body.fullName || ""

    ).trim();



    const email = String(body.email || "")

      .trim()

      .toLowerCase();



    const phoneNumber = String(

      body.phoneNumber || ""

    ).trim();



    const password = String(

      body.password || ""

    );



    const role =

      body.role === "admin"

        ? "admin"

        : "caregiver";



    if (!fullName) {

      return NextResponse.json(

        {

          error: "Full name is required.",

        },

        {

          status: 400,

        }

      );

    }



    if (!email) {

      return NextResponse.json(

        {

          error: "Email is required.",

        },

        {

          status: 400,

        }

      );

    }



    if (!phoneNumber) {

      return NextResponse.json(

        {

          error: "Phone number is required.",

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

            "Enter the phone number in Rwanda international format, for example +250788123456.",

        },

        {

          status: 400,

        }

      );

    }



    if (password.length < 8) {

      return NextResponse.json(

        {

          error:

            "Password must contain at least 8 characters.",

        },

        {

          status: 400,

        }

      );

    }



    const {

      data: newUserData,

      error: createError,

    } =

      await adminClient.auth.admin.createUser({

        email,

        password,

        email_confirm: true,

        user_metadata: {

          full_name: fullName,

        },

      });



    if (

      createError ||

      !newUserData.user

    ) {

      return NextResponse.json(

        {

          error:

            createError?.message ||

            "Could not create user.",

        },

        {

          status: 400,

        }

      );

    }



    /*

     * The auth trigger does not create a profile here

     * because organization_id is not supplied through

     * user metadata.

     *

     * Create the profile using an RPC so the audit

     * trigger knows which administrator created it.

     */

    const { error: profileError } =

      await adminClient.rpc(

        "admin_create_profile",

        {

          target_user_id:

            newUserData.user.id,

          target_organization_id:

            currentAdminProfile.organization_id,

          actor_user_id:

            currentAdmin.id,

          target_full_name:

            fullName,

          target_phone_number:

            phoneNumber,

          target_role:

            role,

        }

      );



    if (profileError) {

      await adminClient.auth.admin.deleteUser(

        newUserData.user.id

      );



      return NextResponse.json(

        {

          error: profileError.message,

        },

        {

          status: 500,

        }

      );

    }



    return NextResponse.json({

      user: {

        id: newUserData.user.id,

        email,

        fullName,

        phoneNumber,

        role,

        active: true,

      },

    });

  } catch {

    return NextResponse.json(

      {

        error: "Invalid request.",

      },

      {

        status: 400,

      }

    );

  }

}



export async function PATCH(request: NextRequest) {

  const verification =

    await verifyAdministrator(request);



  if ("error" in verification) {

    return NextResponse.json(

      {

        error: verification.error,

      },

      {

        status: verification.status,

      }

    );

  }



  const {

    adminClient,

    user: currentAdmin,

    profile: currentAdminProfile,

  } = verification;



  try {

    const body = await request.json();



    const userId = String(

      body.userId || ""

    ).trim();



    const active = body.active;



    const newPassword = String(

      body.newPassword || ""

    );



    const hasPhoneNumber =

      Object.prototype.hasOwnProperty.call(

        body,

        "phoneNumber"

      );



    if (!userId) {

      return NextResponse.json(

        {

          error: "User ID is required.",

        },

        {

          status: 400,

        }

      );

    }



    // Verify target belongs to this organization.

    const {

      data: targetProfile,

      error: targetProfileError,

    } = await adminClient

      .from("profiles")

      .select("id, organization_id")

      .eq("id", userId)

      .eq(

        "organization_id",

        currentAdminProfile.organization_id

      )

      .maybeSingle();



    if (targetProfileError) {

      return NextResponse.json(

        {

          error: targetProfileError.message,

        },

        {

          status: 500,

        }

      );

    }



    if (!targetProfile) {

      return NextResponse.json(

        {

          error:

            "User not found in your organization.",

        },

        {

          status: 404,

        }

      );

    }



    // Update phone number.

    if (hasPhoneNumber) {

      const phoneNumber = String(

        body.phoneNumber || ""

      ).trim();



      if (!phoneNumber) {

        return NextResponse.json(

          {

            error:

              "Phone number is required.",

          },

          {

            status: 400,

          }

        );

      }



      if (

        !isValidRwandaPhone(phoneNumber)

      ) {

        return NextResponse.json(

          {

            error:

              "Enter the phone number in Rwanda international format, for example +250788123456.",

          },

          {

            status: 400,

          }

        );

      }



      const { error: phoneError } =

        await adminClient.rpc(

          "admin_update_profile",

          {

            target_user_id: userId,

            target_organization_id:

              currentAdminProfile.organization_id,

            actor_user_id:

              currentAdmin.id,

            new_phone_number:

              phoneNumber,

            new_active: null,

          }

        );



      if (phoneError) {

        return NextResponse.json(

          {

            error: phoneError.message,

          },

          {

            status: 500,

          }

        );

      }



      return NextResponse.json({

        success: true,

        phoneNumber,

      });

    }



    // Reset password.

    if (newPassword) {

      if (newPassword.length < 8) {

        return NextResponse.json(

          {

            error:

              "Temporary password must contain at least 8 characters.",

          },

          {

            status: 400,

          }

        );

      }



      const { error: passwordError } =

        await adminClient.auth.admin

          .updateUserById(

            userId,

            {

              password: newPassword,

            }

          );



      if (passwordError) {

        return NextResponse.json(

          {

            error: passwordError.message,

          },

          {

            status: 500,

          }

        );

      }



      return NextResponse.json({

        success: true,

      });

    }



    // Activate / deactivate user.

    if (typeof active !== "boolean") {

      return NextResponse.json(

        {

          error: "Invalid user update.",

        },

        {

          status: 400,

        }

      );

    }



    if (

      userId === currentAdmin.id &&

      active === false

    ) {

      return NextResponse.json(

        {

          error:

            "You cannot deactivate your own administrator account.",

        },

        {

          status: 400,

        }

      );

    }



    const { error: updateError } =

      await adminClient.rpc(

        "admin_update_profile",

        {

          target_user_id: userId,

          target_organization_id:

            currentAdminProfile.organization_id,

          actor_user_id:

            currentAdmin.id,

          new_phone_number: null,

          new_active: active,

        }

      );



    if (updateError) {

      return NextResponse.json(

        {

          error: updateError.message,

        },

        {

          status: 500,

        }

      );

    }



    return NextResponse.json({

      success: true,

    });

  } catch {

    return NextResponse.json(

      {

        error: "Invalid request.",

      },

      {

        status: 400,

      }

    );

  }

}