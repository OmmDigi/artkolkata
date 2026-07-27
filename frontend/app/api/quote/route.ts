import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = "https://clexenrentals.com/Submit_quote";
    
    // We are setting up the payload as requested
    const formData = new FormData();
    formData.append("_token", "g9j112BacJtP4SgvwqYrmj2wmQlS200SRptObF08");
    formData.append("service", "rent");
    formData.append("category", "24");
    formData.append("sub_category", "55");
    formData.append("child_category", "183");
    formData.append("company_name", "qwerqwre");
    formData.append("first_name", "qwewqt");
    formData.append("last_name", "uytr");
    formData.append("mobile", "8888888888");
    formData.append("email", "sadsa@fsdf.in");
    formData.append("country", "95");
    formData.append("state", "4117");
    formData.append("city", "55134");
    formData.append("quantity", "2");
    formData.append("start_date", "2026-07-31");
    formData.append("duration_type", "Daily");
    formData.append("duration_time", "5000");
    formData.append("quote_desc", "gfdgfdg");
    formData.append("product_name", "");

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      console.log("submit1"); // Output 'submit1' on successful submit
      return NextResponse.json({ message: "submit1", success: true });
    } else {
      console.error("Failed to submit quote, status:", response.status);
      return NextResponse.json(
        { message: "Submission failed", success: false },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error("Error submitting quote:", error);
    return NextResponse.json(
      { message: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
