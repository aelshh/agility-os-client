import type { CsvPlatform } from "../../api/hrms";

/**
 * Static HRMS platform metadata: how the user downloads the CSV from each
 * system and how we map its columns. Sources: HRMS-CSV-context.md.
 */

export type CsvPlatformInfo = {
  id: CsvPlatform;
  name: string;
  tagline: string;
  description: string;
  steps: string[];
  requiredFields: string[];
  /** The first-row header the system accepts for this platform (copyable). */
  acceptedHeader: string;
  importantNote: string;
  sampleCsv: string;
};

const KEKA_SAMPLE = [
  "Employee Number,First Name,Last Name,Work Email,Mobile Number,Job Title,Department,Business Unit,Location,Reports To Email,Reports To Name,Date of Joining,Employment Status",
  "KEKA-101,Rajesh,Sharma,rajesh.sharma@acme.com,+919876543210,Chief Executive Officer,Executive,Acme India,Mumbai,rajesh.sharma@acme.com,Rajesh Sharma,2020-01-15,Active",
  "KEKA-102,Deepak,Verma,deepak.verma@acme.com,+919876543211,VP of Sales,Sales,Acme India,Bangalore,rajesh.sharma@acme.com,Rajesh Sharma,2021-04-01,Active",
  "KEKA-103,Priya,Nair,priya.nair@acme.com,+919876543212,Area Sales Manager,Sales,Acme India,Bangalore,deepak.verma@acme.com,Deepak Verma,2022-06-10,Active",
].join("\n");

const DARWINBOX_SAMPLE = [
  "Employee ID,Full Name,Official Email ID,Contact Number,Designation,Department,Reports To ID,Reports To Name,Work Location,Date of Joining,Employee Status",
  "DB0001,Rajesh Sharma,rajesh.sharma@acme.com,+919876543210,Chief Executive Officer,Executive,,None,Mumbai,2020-01-15,Active",
  "DB0002,Deepak Verma,deepak.verma@acme.com,+919876543211,VP of Sales,Sales,DB0001,Rajesh Sharma,Bangalore,2021-04-01,Active",
  "DB0003,Priya Nair,priya.nair@acme.com,+919876543212,Area Sales Manager,Sales,DB0002,Deepak Verma,Bangalore,2022-06-10,Active",
].join("\n");

const PEOPLEHR_SAMPLE = [
  "Employee Id,First Name,Last Name,Email,Mobile,Job Title,Department,Reports To,Location,Start Date,Status",
  "PHR-001,Rajesh,Sharma,rajesh.sharma@acme.com,+919876543210,Chief Executive Officer,Executive,,Mumbai,2020-01-15,Active",
  "PHR-002,Deepak,Verma,deepak.verma@acme.com,+919876543211,VP of Sales,Sales,rajesh.sharma@acme.com,Bangalore,2021-04-01,Active",
  "PHR-003,Priya,Nair,priya.nair@acme.com,+919876543212,Area Sales Manager,Sales,deepak.verma@acme.com,Bangalore,2022-06-10,Active",
].join("\n");

export const CSV_PLATFORMS: CsvPlatformInfo[] = [
  {
    id: "keka",
    name: "Keka",
    tagline: "Indian HR & payroll suite",
    description:
      "Export the Employee Master Details report from the Keka admin portal.",
    steps: [
      "Log in to the Keka Admin Portal.",
      "Open the left menu → Org → Dashboard.",
      "Scroll to Employee Reports and select Employee Info.",
      "Choose Employee Master Details (or Reporting Managers Report).",
      "Select your Business Unit (mandatory) and set Employment Status to Active.",
      "Click Run, then the Download icon → Export as CSV / Excel.",
      "Upload the downloaded CSV here.",
    ],
    requiredFields: [
      "Employee Number",
      "First Name",
      "Last Name",
      "Work Email",
      "Job Title",
      "Department",
      "Reports To Email",
    ],
    acceptedHeader:
      "Employee Number,First Name,Last Name,Work Email,Mobile Number,Job Title,Department,Business Unit,Location,Reports To Email,Reports To Name,Date of Joining,Employment Status",
    importantNote:
      "On Keka the CEO's Reports To points to themselves - we detect this automatically and mark them as the org root.",
    sampleCsv: KEKA_SAMPLE,
  },
  {
    id: "darwinbox",
    name: "Darwinbox",
    tagline: "Enterprise HRMS platform",
    description:
      "Export the Employee Master Dump / Employee Directory report from Darwinbox.",
    steps: [
      "Log in to the Darwinbox Admin Portal.",
      "Go to Analytics & Reports → Standard Reports.",
      "Select Employee Master Dump or Employee Directory Report.",
      "Confirm these fields exist: Employee ID, Full Name, Official Email ID, Designation, Department, Reports To ID, Reports To Name, Work Location, Date of Joining, Employee Status.",
      "Click Run Report / Export → Export as CSV.",
      "Upload the downloaded CSV here.",
    ],
    requiredFields: [
      "Employee ID",
      "Full Name",
      "Official Email ID",
      "Designation",
      "Department",
      "Reports To ID",
    ],
    acceptedHeader:
      "Employee ID,Full Name,Official Email ID,Contact Number,Designation,Department,Reports To ID,Reports To Name,Work Location,Date of Joining,Employee Status",
    importantNote:
      "The top-level executive has an empty or 'None' Reports To ID — we treat that row as the org root.",
    sampleCsv: DARWINBOX_SAMPLE,
  },
  {
    id: "peoplehr",
    name: "PeopleHR",
    tagline: "The Access Group HR platform",
    description:
      "Build a Query Builder report for the Employee entity in PeopleHR.",
    steps: [
      "Log in to the PeopleHR Admin Portal.",
      "Go to Reports → Query Builder (or Queries).",
      "Click Create New Query → select the Employee entity.",
      "Pick columns: Employee Id, First Name, Last Name, Email, Mobile/Telephone, Job Title, Department, Reports To, Location, Start Date, Status.",
      "Click Run Query → Export → Select Export as CSV.",
      "Upload the downloaded CSV here.",
    ],
    requiredFields: [
      "Employee Id",
      "First Name",
      "Last Name",
      "Email",
      "Job Title",
      "Department",
      "Reports To",
    ],
    acceptedHeader:
      "Employee Id,First Name,Last Name,Email,Mobile,Job Title,Department,Reports To,Location,Start Date,Status",
    importantNote:
      "PeopleHR's 'Reports To' column may contain either the manager's email or their full name — we resolve both automatically.",
    sampleCsv: PEOPLEHR_SAMPLE,
  },
];

export function getPlatformInfo(id: CsvPlatform): CsvPlatformInfo {
  return CSV_PLATFORMS.find((p) => p.id === id) ?? CSV_PLATFORMS[0];
}