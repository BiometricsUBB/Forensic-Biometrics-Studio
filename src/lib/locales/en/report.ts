import { i18nReport as Dictionary } from "@/lib/locales/translation";

const d: Dictionary = {
    "Technical report title":
        "Technical report of forensic trace image comparison",
    "Report ID label": "Report ID:",
    "Report date and time label": "Report date and time:",
    "Performed by label": "Performed by:",
    "Software information": "Software information",
    "Application name": "Application name:",
    "Application version": "Application version:",
    "Input material": "Input material",
    "Image 1": "Image 1",
    "Image 2": "Image 2",
    "File name": "File name:",
    "Image dimensions": "Image dimensions:",
    Dimensions: "dimensions:",
    Size: "size:",
    Checksum: "checksum:",
    "Matched features count": "Number of matched features on both images:",
    "Selected features count": "Number selected for the report:",
    "Figure 1": "Fig. 1 Image 1 original",
    "Figure 2":
        "Fig. 2 Image 1 with all features determined during examination",
    "Figure 3": "Fig. 3 Image 2 original",
    "Figure 4":
        "Fig. 4 Image 2 with all features determined during examination",
    "Image 1 label": "Image 1:",
    "Image 2 label": "Image 2:",
    "Comparative table overview":
        "Comparative table of selected features \u2013 overview",
    "Comparative table zoom":
        "Comparative table of selected features \u2013 zoomed",
    "Comparative table details":
        "Comparative table of selected features \u2013 details",
    Feature: "Feature",
    "Feature type": "Feature type:",
    Page: "Page",
    "Note title": "Note",
    "Note body":
        "The report identifier confirms the authenticity of the report and is calculated from the input data and the system identifier.",
    "Signature verification report title":
        "Technical report on signature comparison (Grafotype method)",
    "Parameters summary": "Parameters summary and conformity verification",
    "Sample A": "Sample A",
    "Sample B": "Sample B",
    "Rank correlation analysis": "Rank correlation analysis (outline segments)",
    "Segment length": "Segment length [px]",
    Rank: "Rank",
    "Signature A figure": "Figure: signature A with outline and axes",
    "Signature B figure": "Figure: signature B with outline and axes",
    "Not available": "n/a",
    "Shoeprint report title":
        "Technical report of forensic shoeprint image comparison",
    "Shoeprint paired features count": "Number of paired features (by label):",
    "Shoeprint figure 3": "Fig. 3 Image 2 original (shoeprint)",
    "Shoeprint figure 4":
        "Fig. 4 Image 2 with all features determined during examination",
    "Shoeprint comparative table overview":
        "Comparative table of selected features - overview",
    "Shoeprint comparative table details":
        "Comparative table of selected features - details",
    "Shoeprint pattern features title":
        "Structural features of classificatory significance",
    "Shoeprint group features title":
        "Group features of classificatory significance",
    "Shoeprint feature type prefix": "Feature type:",
    "Shoeprint no unique features": "No unique features found.",
    "Shoeprint comparison title": "Automated statistical comparison",
    "Shoeprint comparison method":
        "The comparison was performed with the shoeprintr algorithm (Park & Carriquiry, CSAFE, Iowa State University). Three regions of interest are fixed on print Q; for each one the algorithm searches print K for the corresponding region by finding the largest set of mutually consistent point correspondences (a maximum clique), and then estimates the rotation and the degree of overlap between the two regions.",
    "Shoeprint comparison summary": "Summary of similarity features",
    "Shoeprint comparison regions": "Matched regions",
    "Shoeprint comparison distances": "Distances between region centres",
    "Shoeprint comparison figure":
        "Regions fixed on print Q and the corresponding regions located in print K.",
    "Shoeprint comparison parameters": "Analysis parameters",
    "Shoeprint comparison disclaimer":
        "These values describe the degree of geometric agreement measured between the two impressions. They are not a probability of common origin and do not by themselves constitute an identification. Interpretation remains the responsibility of the examiner.",
    "Shoeprint comparison scale warning":
        "At least one image had no resolution set, so the distances below are expressed in working units rather than millimetres and should not be read as physical measurements.",
    "Shoeprint comparison scale mismatch":
        "The two prints were reduced to different working scales, so region distances are not directly comparable.",
};

export default d;
