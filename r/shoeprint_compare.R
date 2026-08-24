#!/usr/bin/env Rscript

## shoeprint_compare.R
##
## Command-line bridge between Forensic Biometrics Studio and the CSAFE
## `shoeprintr` package (https://github.com/CSAFE-ISU/shoeprintr).
##
## The app extracts edge point clouds from the two loaded shoeprint images and
## writes them as CSV; this script feeds them to shoeprintr's subarea matching
## routine and writes the match statistics back as JSON, plus an overview figure
## for the PDF report.
##
## Usage:
##   Rscript --vanilla shoeprint_compare.R \
##       --input <questioned.csv> --reference <known.csv> --output <result.json> \
##       [--plot <figure.png>] [--max-rotation 30] [--radius 50] [--seed 1] [--cores N]
##       [--ref-sample 220] [--ref-sample-final 420]   # 0 = match every point
##   Rscript --vanilla shoeprint_compare.R --check
##
## CSV format: a header row `x,y` followed by numeric coordinates. The app emits
## a bottom-left origin (y increasing towards the toe), which is what
## shoeprintr's toe/heel subarea heuristics assume.
##
## Exit codes:
##   0  success
##   1  bad arguments / unreadable input
##   2  R dependency missing
##   3  matching failed
##   4  could not write output

## sp and vec2dtransf are S4-based, and Rscript does not attach `methods` by
## default -- without this the affine transformation step fails at runtime.
suppressPackageStartupMessages(library(methods))

SCHEMA_VERSION <- 1
EXIT_OK <- 0
EXIT_USAGE <- 1
EXIT_DEPENDENCY <- 2
EXIT_MATCHING <- 3
EXIT_OUTPUT <- 4

## ---------------------------------------------------------------------------
## Progress + logging
## ---------------------------------------------------------------------------

emit_progress <- function(stage, percent, message = "") {
    cat(sprintf("PROGRESS|%s|%d|%s\n", stage, as.integer(percent), message),
        file = stderr())
    flush(stderr())
}

emit_log <- function(...) {
    cat(sprintf("LOG|%s\n", paste0(...)), file = stderr())
    flush(stderr())
}

## ---------------------------------------------------------------------------
## Argument parsing
## ---------------------------------------------------------------------------

parse_args <- function(argv) {
    opts <- list(
        input = NULL,
        reference = NULL,
        output = NULL,
        plot = NULL,
        max_rotation = 30,
        radius = 50,
        ref_sample = 220,
        ref_sample_final = 420,
        seed = 1,
        cores = 0,
        check = FALSE,
        version = FALSE
    )

    i <- 1
    while (i <= length(argv)) {
        key <- argv[[i]]
        take_value <- function() {
            if (i + 1 > length(argv)) {
                stop(sprintf("missing value for argument '%s'", key), call. = FALSE)
            }
            argv[[i + 1]]
        }
        switch(key,
            "--input"        = { opts$input <- take_value(); i <- i + 2 },
            "--reference"    = { opts$reference <- take_value(); i <- i + 2 },
            "--output"       = { opts$output <- take_value(); i <- i + 2 },
            "--plot"         = { opts$plot <- take_value(); i <- i + 2 },
            "--max-rotation" = { opts$max_rotation <- as.numeric(take_value()); i <- i + 2 },
            "--radius"       = { opts$radius <- as.numeric(take_value()); i <- i + 2 },
            "--ref-sample"   = { opts$ref_sample <- as.integer(take_value()); i <- i + 2 },
            "--ref-sample-final" = { opts$ref_sample_final <- as.integer(take_value()); i <- i + 2 },
            "--seed"         = { opts$seed <- as.integer(take_value()); i <- i + 2 },
            "--cores"        = { opts$cores <- as.integer(take_value()); i <- i + 2 },
            "--check"        = { opts$check <- TRUE; i <- i + 1 },
            "--version"      = { opts$version <- TRUE; i <- i + 1 },
            stop(sprintf("unknown argument '%s'", key), call. = FALSE)
        )
    }
    opts
}

## ---------------------------------------------------------------------------
## Runtime shim
## ---------------------------------------------------------------------------
##
## shoeprintr is installed exactly as published (upstream commit 269e99f), but
## its boosted_clique() has two defects that are fatal for an installed desktop
## application on Windows -- the pmc solver path is pasted into a shell string,
## and the solver's output is parsed with a pattern that misses one of the two
## forms pmc emits -- plus no working parallelism there. Rather than modify the
## package, this replaces that one function in its namespace at startup. The
## body below is upstream's, with three marked FBS FIX blocks and nothing else.

fbs_boosted_clique <- function(circle_in, circle_ref, ncross_in_bins = 30, xbins_in = 20, ncross_in_bin_size = 1, ncross_ref_bins = NULL, xbins_ref = 30, ncross_ref_bin_size = NULL, eps = .75, seed = 1, num_cores = 8, plot = TRUE, verbose = FALSE, cl = NULL) {
    if (is.null(cl)) cl <- getOption("shoeprintr.cluster", NULL)
    start_time_i <- Sys.time()
    if(verbose) cat("Preparing circles data for edge matching.\n")
    ## Smart sample input circle points
    c_in <- smart_sample(circle_in,sample_bins=min(ncross_in_bins,nrow(circle_in)),xbins=xbins_in,sample_size=ncross_in_bin_size,seed=seed)
    ## Smart sample reference circle points or full points
    c_ref <- smart_sample(circle_ref,sample_bins=min(ncross_ref_bins,nrow(circle_ref)),xbins=xbins_ref,sample_size=ncross_ref_bin_size,seed=seed)

    ## Data dimesion for later reference within function
    la <- nrow(c_in)					## Number of minutiae in image 1
    lb <- nrow(c_ref)					## Number of minutiae in image 2
    lg <- la * lb						## Number of vertices in the "product graph"

    ## Pairwise distance matrix between vertices in input and reference data
    dist_in <- as.matrix(dist(c_in))
    dist_ref <- as.matrix(dist(c_ref))

    ## Fill NA's to avoid loops
    dist_in[row(dist_in)==col(dist_in)] <- NA
    dist_ref[row(dist_ref)==col(dist_ref)] <- NA

    ## Split matrix to list of columns so as to vectorize calculation of adjacency list
    distl_in <- as.list(as.data.frame(dist_in))
    distl_ref <- as.list(as.data.frame(dist_ref))
    dist_l_grid <- expand.grid(distl_ref,distl_in)

    ## Adding k1 verice 1 name to list
    dist_l_grid$node <- 1:nrow(dist_l_grid)
    dist_l_grid$Var2_n <- mapply(function(x,y) unlist(x)[1:unlist(y)],dist_l_grid[,2],as.list(((1:nrow(dist_l_grid)) %/% lb)+1))
    dist_l_grid <- dist_l_grid[,c("Var1","Var2_n","node")]
    rownames(dist_l_grid) <- 1:nrow(dist_l_grid)
    gc()
    end_time_i <- Sys.time()
    if(verbose) cat(paste("Prepared circles data for edge matching. Took",round(difftime(end_time_i,start_time_i,units="secs")),"Seconds.\n\n\n"))

    start_time_al <- Sys.time()
    if(verbose) cat("Calculating adjacency list.\n")

    ## Split data to distribute work to cores
    dist_l_grid_core_assign <- split(dist_l_grid,floor(seq(0,((num_cores*4)-.01),length.out=nrow(dist_l_grid))))

    ## Windows
    if (!is.null(cl)) {
        final_ks <- do.call(c,parLapply(cl, dist_l_grid_core_assign,function(x,eps,la,lb) {gc();apply(x,1,get_edge_vertice,eps=eps,la=la,lb=lb)},eps=eps,la=la,lb=lb))
    ## Mac/Linux
    } else {
        final_ks <- do.call(c,mclapply(dist_l_grid_core_assign,function(x,eps,la,lb) {gc();apply(x,1,get_edge_vertice,eps=eps,la=la,lb=lb)},eps=eps,la=la,lb=lb,mc.cores=num_cores))
    }

    gc()

    end_time_al <- Sys.time()
    if(verbose) cat(paste("Calculated adjacency list. Took",round(difftime(end_time_al,start_time_al,units="secs")),"Seconds.\n\n\n"))

    start_time_mc <- Sys.time()
    if(verbose) cat("Finding largest clique.\n")

    ## Prune edge list and write it to disk for parallel clique calculation
    fro_node_name <- rep(as.numeric(sapply(names(final_ks),function(x) strsplit(x,"\\.")[[1]][2],USE.NAMES=FALSE)),sapply(final_ks,length))
    to_node_name <- unlist(final_ks,use.names=FALSE)
    edge_list <- paste(fro_node_name,to_node_name," ")[to_node_name<fro_node_name]
    edge_list[length(edge_list)] <- gsub("  "," ",edge_list[length(edge_list)])
    edge_list_pmc_format <- c(	"%%MatrixMarket matrix coordinate pattern symmetric  ",
                               paste(nrow(dist_l_grid),nrow(dist_l_grid),length(edge_list)," "),
                               edge_list
    )
    mytempdir <- tempdir()
    edge_file <- file.path(mytempdir, "edge.mtx")
    writeLines(edge_list_pmc_format, edge_file)
    ext <- ifelse(get_os() == "win64", ".exe", "")
    pmc_bin <- system.file(package = "shoeprintr", "bin", get_os(), paste0("pmc", ext))

    clique_max <- system2(pmc_bin, c("-f", shQuote(edge_file), "-a", "0"), stdout = TRUE)

    clique_lines <- grep("Maximum clique:", clique_max, value = TRUE, fixed = TRUE)
    if (length(clique_lines) == 0) {
        clique_max <- numeric(0)
    } else {
        anchored <- grep("^Maximum clique: ", clique_lines, value = TRUE)
        chosen <- if (length(anchored) > 0) anchored[length(anchored)] else clique_lines[length(clique_lines)]
        tokens <- unlist(strsplit(sub("^.*Maximum clique: ", "", chosen), " "))
        clique_max <- as.numeric(tokens[nzchar(trimws(tokens))])
        clique_max <- clique_max[!is.na(clique_max)]
    }

    gc()

    end_time_mc <- Sys.time()
    if(verbose) cat(paste("Calculated largest clique. Took",round(difftime(end_time_mc,start_time_mc,units="secs")),"Seconds.\n\n\n"))


    ## Get and return clique stats
    return(get_clique_stats(clique_max,c_in,circle_in,c_ref,circle_ref,la=la,lb=lb,plot=plot))
}

fbs_match_print_subarea <- function(input, reference, input_circles, max_rotation_angle,
                                    ncross_ref_bins = NULL, ncross_ref_bin_size = NULL,
                                    ncross_ref_bins_final = NULL, ncross_ref_bin_size_final = NULL) {

  if (is.null(input_circles)) {
    circles_dims <- apply(input, 2, function(x) max(x) -  min(x))
    circle_centers1 <- matrix( c(0.3, 0.85, 0.25, 0.3, 0.75, 0.75), 3, byrow = TRUE, dimnames = list(NULL, c("x", "y"))) %*% diag(circles_dims)
    circle_centers2 <- circle_centers1 + matrix(c(min(input[,1]), min(input[,1]), min(input[,1]), min(input[,2]),min(input[,2]),min(input[,2])), 3, byrow=FALSE)
    circle_centers3 <- cbind(circle_centers2, c(50, 50, 50))
    input_circles<-circle_centers3
  }   else {
    input_circles <- input_circles
  }


  ref<-data.frame(reference)
  ref_len_y<-(max(reference[,2])-min(reference[,2]))
  ref_len_x<-(max(reference[,1])-min(reference[,1]))

  ref_top<-subset(ref, y>0.5*ref_len_y+min(reference[,2]))
  ref_bottom<-subset(ref, y<=0.5*ref_len_y+min(reference[,2]))


  location_ref<-list()

  location_ref[[1]]<-subset(ref_top, x<(ref_len_x/2+min(reference[,1]))) # ref_top_left
  location_ref[[2]]<-subset(ref_bottom, x<(ref_len_x/2+min(reference[,1]))) #ref_bottom_left
  location_ref[[3]]<-subset(ref_top, x>=(ref_len_x/2+min(reference[,1]))) #ref_top_right
  location_ref[[4]]<-subset(ref_bottom, x>=(ref_len_x/2+min(reference[,1]))) #ref_bottom_right

  nseg=360
  in.cx<-NULL
  in.cy<-NULL
  in.r<-NULL
  final.cx<-NULL
  final.cy<-NULL
  final.r<-NULL
  MM<-NULL
  FM<-NULL
  ref_loc<-NULL
  rd_score<-NULL
  WM<-NULL
  ref_loc<-NULL
  rd_score<-NULL
  wrong_mat<-NULL
  WW<-NULL
  wrong_set<-NULL

  K<-matrix(c(2,3,4,1,3,4,1,2,4,1,2,3), nrow=4, byrow=T)

  for ( k in 1:3){

    print(paste("circle",k,"matching"))
    in.cx[k]<-input_circles[k,1]
    in.cy[k]<-input_circles[k,2]
    in.r[k]<-input_circles[k,3]

    circle_in<-data.frame(int_inside_center(data.frame(input), in.r[k], nseg, in.cx[k], in.cy[k]))


    R<-NULL
    r_ref<-(input_circles[1,3]+15)

    ref_loc<-location_ref[[k]]

    ref_loc_len_x<-(max(ref_loc$x)-min(ref_loc$x))
    ref_loc_len_y<-(max(ref_loc$y)-min(ref_loc$y))


    if(min(ref_loc$y)+r_ref<max(ref_loc$y)-r_ref){
      ref_cdd_y<-seq(min(ref_loc$y)+r_ref, max(ref_loc$y), by = r_ref)} else {
        ref_cdd_y<-seq(min(ref_loc$y)+r_ref, max(ref_loc$y)+r_ref, by = r_ref)
      }

    ref_cdd_x<-(min(ref_loc$x)+max(ref_loc$x))/2


    for ( j in 1:length(ref_cdd_y)){
      circle_cdd_ref<-data.frame(int_inside_center(data.frame(ref), r_ref, nseg, ref_cdd_x, ref_cdd_y[j]))

      if(nrow(circle_cdd_ref)>(nrow(circle_in)*0.2)){
        M<-try(boosted_clique(circle_in, circle_cdd_ref, ncross_in_bins = 30, xbins_in = 20,
                              ncross_in_bin_size = 1, ncross_ref_bins = ncross_ref_bins, xbins_ref = 30,
                              ncross_ref_bin_size = ncross_ref_bin_size, eps = 0.75, seed = 1, num_cores = parallel::detectCores()-1,
                              plot = FALSE, verbose = FALSE, cl = NULL))

        if (sum(is.na(M[[1]]))<1) {
          M2<-M$clique_stats
          Mat<-paste0('mat',j)
          R<-rbind(R,cbind(Mat,M2))}
      }
    }



    R1<-subset(R,rotation_angle<max_rotation_angle)

    if (nrow(R1)!=0){
      new.cx<-R1[which.max(R1$input_overlap),7]
      new.cy<-R1[which.max(R1$input_overlap),8]
      new.r<-R1[which.max(R1$input_overlap),9]+15} else{

        new.cx<-R[which.max(R$input_overlap),7]
        new.cy<-R[which.max(R$input_overlap),8]
        new.r<-R[which.max(R$input_overlap),9]+15
      }


    circle_ref<-data.frame(int_inside_center(data.frame(reference), new.r, nseg, new.cx, new.cy))
    step2_mat<-boosted_clique(circle_in, circle_ref, ncross_in_bins = 30, xbins_in = 20,
                              ncross_in_bin_size = 1, ncross_ref_bins = ncross_ref_bins_final, xbins_ref = 30,
                              ncross_ref_bin_size = ncross_ref_bin_size_final, eps = 0.75, seed = 1, num_cores = parallel::detectCores()-1,
                              plot = FALSE, verbose = FALSE, cl = NULL)$clique_stats

    final.cx[k]<-step2_mat[,6]
    final.cy[k]<-step2_mat[,7]
    final.r[k]<-step2_mat[,8]

    MM<-rbind(MM,step2_mat)
  }

  Input_X<-input_circles[,1]
  Input_Y<-input_circles[,2]
  Comp<-c('1-2','1-3','2-3')
  d_in_1<-sqrt((Input_X[1]-Input_X[2])^2+(Input_Y[1]-Input_Y[2])^2)
  d_in_2<-sqrt((Input_X[1]-Input_X[3])^2+(Input_Y[1]-Input_Y[3])^2)
  d_in_3<-sqrt((Input_X[2]-Input_X[3])^2+(Input_Y[2]-Input_Y[3])^2)
  Euc_input_dist<-c(d_in_1,d_in_2,d_in_3)
  Reference_X<-MM[,6]
  Reference_Y<-MM[,7]
  d_ref_1<-sqrt((Reference_X[1]-Reference_X[2])^2+(Reference_Y[1]-Reference_Y[2])^2)
  d_ref_2<-sqrt((Reference_X[1]-Reference_X[3])^2+(Reference_Y[1]-Reference_Y[3])^2)
  d_ref_3<-sqrt((Reference_X[2]-Reference_X[3])^2+(Reference_Y[2]-Reference_Y[3])^2)
  Euc_ref_dist<-c(d_ref_1,d_ref_2,d_ref_3)
  Reference_radius<-MM[,8]

  FM<-data.frame(Input_X,Input_Y,Reference_X,Reference_Y,Reference_radius,MM[,c(1:5)],Comp,Euc_input_dist,Euc_ref_dist)


  P1<-ggplot(data.frame(input), aes(x=x, y=y))+ geom_point(data=data.frame(input), aes(x=x, y=y), color='black',size=0.1) +
    geom_point(data=data.frame(int_inside_center(data.frame(input), in.r[1], nseg, in.cx[1], in.cy[1])),color="red",size=0.1)+
    gg_circle(in.r[1], xc=in.cx[1], yc=in.cy[1], color="red") +
    geom_point(data=data.frame(int_inside_center(data.frame(input), in.r[2], nseg, in.cx[2], in.cy[2])),color="yellow",size=0.1)+
    gg_circle(in.r[2], xc=in.cx[2], yc=in.cy[2], color="yellow") +
    geom_point(data=data.frame(int_inside_center(data.frame(input), in.r[3], nseg, in.cx[3], in.cy[3])),color="green",size=0.1)+
    gg_circle(in.r[3], xc=in.cx[3], yc=in.cy[3], color="green")


  P2<-ggplot(data.frame(reference), aes(x=x, y=y))+ geom_point(data=data.frame(reference), aes(x=x, y=y), color='black',size=0.1) +
    geom_point(data=data.frame(int_inside_center(data.frame(reference), final.r[1], nseg, final.cx[1],final.cy[1])),color="red",size=0.1)+
    gg_circle(final.r[1], xc=final.cx[1], yc=final.cy[1], color="red") +
    geom_point(data=data.frame(int_inside_center(data.frame(reference), final.r[2], nseg, final.cx[2],final.cy[2])),color="yellow",size=0.1)+
    gg_circle(final.r[2], xc=final.cx[2], yc=final.cy[2], color="yellow") +
    geom_point(data=data.frame(int_inside_center(data.frame(reference), final.r[3], nseg, final.cx[3],final.cy[3])),color="green",size=0.1)+
    gg_circle(final.r[3], xc=final.cx[3], yc=final.cy[3], color="green")

  try(multiplot(P1, P2, cols=2))


  return(FM)
}

## assignInNamespace() replaces the namespace binding, so match_print_subarea()
## picks the shim up for its own internal calls.
install_runtime_shim <- function() {
    shim <- fbs_boosted_clique
    environment(shim) <- asNamespace("shoeprintr")
    utils::assignInNamespace("boosted_clique", shim, ns = "shoeprintr")

    subarea <- fbs_match_print_subarea
    environment(subarea) <- asNamespace("shoeprintr")
    utils::assignInNamespace("match_print_subarea", subarea, ns = "shoeprintr")
    invisible(TRUE)
}

## Dependency loading
load_dependencies <- function() {
    required <- c("jsonlite", "hexbin", "vec2dtransf", "sp", "dplyr",
                  "ggplot2", "gridExtra", "shoeprintr")
    missing <- required[!vapply(required, requireNamespace, logical(1),
                                quietly = TRUE)]
    if (length(missing) > 0) {
        stop(sprintf("missing R packages: %s", paste(missing, collapse = ", ")),
             call. = FALSE)
    }
    suppressPackageStartupMessages({
        library(shoeprintr)
        library(ggplot2)
    })
    install_runtime_shim()
    invisible(TRUE)
}

pmc_binary_path <- function() {
    os_dir <- if (grepl("darwin", version$os)) {
        "mac64"
    } else if (grepl("linux", version$os)) {
        "lin64"
    } else {
        "win64"
    }
    ext <- if (identical(os_dir, "win64")) ".exe" else ""
    system.file(package = "shoeprintr", "bin", os_dir, paste0("pmc", ext))
}

## Confirms the maximum-clique solver is present and actually executable
check_pmc <- function() {
    pmc <- pmc_binary_path()
    if (!nzchar(pmc) || !file.exists(pmc)) {
        stop("the pmc maximum-clique solver bundled with shoeprintr is missing",
             call. = FALSE)
    }
    probe <- tryCatch(
        suppressWarnings(system2(pmc, character(0),
                                 stdout = TRUE, stderr = TRUE)),
        error = function(e) NULL
    )
    if (is.null(probe) || length(probe) == 0 ||
        !any(grepl("Usage", probe, fixed = TRUE))) {
        stop(sprintf("the pmc solver at '%s' could not be executed", pmc),
             call. = FALSE)
    }
    invisible(pmc)
}

## Input handling
read_points <- function(path, label) {
    if (!file.exists(path)) {
        stop(sprintf("%s point file not found: %s", label, path), call. = FALSE)
    }
    data <- utils::read.csv(path, header = TRUE, stringsAsFactors = FALSE)
    if (!all(c("x", "y") %in% names(data))) {
        stop(sprintf("%s point file must have 'x' and 'y' columns", label),
             call. = FALSE)
    }
    data <- data.frame(x = as.numeric(data$x), y = as.numeric(data$y))
    data <- data[stats::complete.cases(data), ]
    if (nrow(data) < 100) {
        stop(sprintf(
            "%s print has only %d edge points, which is too few to compare; try a higher-contrast image or a lower edge threshold",
            label, nrow(data)), call. = FALSE)
    }
    data
}

to_origin <- function(data) {
    data.frame(x = data$x - min(data$x), y = data$y - min(data$y))
}

bbox_of <- function(data) {
    list(
        width = max(data$x) - min(data$x),
        height = max(data$y) - min(data$y)
    )
}

## Circle placement
count_points_in_circle <- function(data, cx, cy, r) {
    sum((data$x - cx)^2 + (data$y - cy)^2 < r^2)
}

REFERENCE_SEARCH_MARGIN <- 15

assert_regions_fit <- function(print_data, radius, label) {
    span_x <- max(print_data$x) - min(print_data$x)
    span_y <- max(print_data$y) - min(print_data$y)
    smallest <- min(span_x, span_y)

    if (radius + REFERENCE_SEARCH_MARGIN > smallest / 2) {
        stop(sprintf(
            "a %g-unit region radius is too large for the %s print, which spans %.0f x %.0f units; the regions would cover most of it and the clique search would exhaust memory. Reduce the radius, or rescale the prints so the outsole spans a few hundred units.",
            radius, label, span_x, span_y), call. = FALSE)
    }
}

sample_or_null <- function(value) {
    if (is.null(value) || is.na(value) || value < 1) NULL else as.integer(value)
}

## Absolute floor: below this a region cannot support a clique at all.
MIN_REGION_POINTS <- 25

## A region is only worth matching if it carries roughly as much detail as the
## print does on average.
region_point_target <- function(print_data, radius) {
    span_x <- max(print_data$x) - min(print_data$x)
    span_y <- max(print_data$y) - min(print_data$y)
    area <- span_x * span_y
    if (!is.finite(area) || area <= 0) return(MIN_REGION_POINTS)
    expected <- nrow(print_data) * (pi * radius^2) / area
    max(MIN_REGION_POINTS, 0.5 * expected)
}

## initial_circle() fixes the three regions at 30%/85%, 25%/30% and 75%/75% of
## the print's bounding box, and match_print_subarea() then looks for each one
## in the matching quadrant of the known print.
region_search_box <- function(print_data, cx, cy, scope) {
    min_x <- min(print_data$x)
    max_x <- max(print_data$x)
    min_y <- min(print_data$y)
    max_y <- max(print_data$y)
    mid_x <- (min_x + max_x) / 2
    mid_y <- (min_y + max_y) / 2

    box <- c(min_x, max_x, min_y, max_y)
    if (scope %in% c("quadrant", "half")) {
        if (cy < mid_y) box[4] <- mid_y else box[3] <- mid_y
    }
    if (scope == "quadrant") {
        if (cx < mid_x) box[2] <- mid_x else box[1] <- mid_x
    }
    box
}

relocate_region <- function(print_data, cx, cy, radius, placed, min_points) {
    step <- max(radius / 3, 1)

    for (scope in c("quadrant", "half", "print")) {
        box <- region_search_box(print_data, cx, cy, scope)
        grid <- expand.grid(x = seq(box[1], box[2], by = step),
                            y = seq(box[3], box[4], by = step))
        if (nrow(grid) == 0) next

        grid$count <- mapply(function(x, y) {
            count_points_in_circle(print_data, x, y, radius)
        }, grid$x, grid$y)
        grid <- grid[grid$count >= min_points, , drop = FALSE]
        if (nrow(grid) == 0) next

        ## Prefer candidates clear of the regions already placed, but do not
        ## fail over it -- a small print may have nowhere else to go.
        if (length(placed) > 0) {
            clear <- rep(TRUE, nrow(grid))
            for (p in placed) {
                clear <- clear & ((grid$x - p[1])^2 + (grid$y - p[2])^2) >= radius^2
            }
            if (any(clear)) grid <- grid[clear, , drop = FALSE]
        }

        ## Among the densest positions available, take the one closest to where
        ## the region was meant to sit: density first, then fidelity to upstream.
        grid <- grid[grid$count >= 0.8 * max(grid$count), , drop = FALSE]
        nearest <- which.min((grid$x - cx)^2 + (grid$y - cy)^2)
        return(c(grid$x[nearest], grid$y[nearest]))
    }

    NULL
}

build_input_circles <- function(print_in, radius) {
    circles <- shoeprintr::initial_circle(print_in)
    circles[, 3] <- radius

    target <- region_point_target(print_in, radius)
    placed <- list()
    moved <- integer(0)

    for (i in seq_len(nrow(circles))) {
        count <- count_points_in_circle(print_in, circles[i, 1], circles[i, 2], radius)

        if (count < target) {
            found <- relocate_region(print_in, circles[i, 1], circles[i, 2],
                                     radius, placed, target)
            if (is.null(found) && count < MIN_REGION_POINTS) {
                found <- relocate_region(print_in, circles[i, 1], circles[i, 2],
                                         radius, placed, MIN_REGION_POINTS)
            }
            if (is.null(found)) {
                if (count < MIN_REGION_POINTS) {
                    stop(sprintf(
                        "no part of the questioned print carries enough pattern for a %g-unit region; use a print with more visible detail",
                        radius), call. = FALSE)
                }
            } else {
                circles[i, 1:2] <- found
                moved <- c(moved, i)
            }
        }

        placed[[length(placed) + 1L]] <- c(circles[i, 1], circles[i, 2])
    }

    counts <- vapply(seq_len(nrow(circles)), function(i) {
        count_points_in_circle(print_in, circles[i, 1], circles[i, 2], radius)
    }, numeric(1))

    if (length(moved) > 0) {
        emit_log(sprintf("moved region(s) %s onto denser pattern (target %d points)",
                         paste(moved, collapse = ", "), as.integer(target)))
    }
    emit_log(sprintf("input circle point counts: %s (target %d)",
                     paste(counts, collapse = ", "), as.integer(target)))
    circles
}

## Comparison
resolve_cores <- function(requested) {
    detected <- tryCatch(parallel::detectCores(), error = function(e) 1L)
    if (is.na(detected) || detected < 1) detected <- 1L
    if (is.null(requested) || is.na(requested) || requested < 1) {
        return(max(1L, detected - 1L))
    }
    max(1L, min(as.integer(requested), detected))
}

run_comparison <- function(opts) {
    emit_progress("reading", 2, "reading point clouds")
    print_in <- to_origin(shoeprintr::focus_data2(read_points(opts$input, "questioned")))
    print_ref <- to_origin(shoeprintr::focus_data2(read_points(opts$reference, "known")))

    emit_log(sprintf("questioned points: %d, known points: %d",
                     nrow(print_in), nrow(print_ref)))

    emit_progress("preparing", 6, "placing regions of interest")
    assert_regions_fit(print_in, opts$radius, "questioned")
    assert_regions_fit(print_ref, opts$radius, "known")
    input_circles <- build_input_circles(print_in, opts$radius)

    cores <- resolve_cores(opts$cores)
    emit_log(sprintf("using %d core(s)", cores))

    ## One cluster reused across every circle pair.
    cluster <- NULL
    if (cores > 1) {
        cluster <- tryCatch(parallel::makeCluster(cores), error = function(e) {
            emit_log(sprintf("could not start cluster (%s), continuing serially",
                             conditionMessage(e)))
            NULL
        })
    }
    if (!is.null(cluster)) {
        options(shoeprintr.cluster = cluster)
        on.exit({
            options(shoeprintr.cluster = NULL)
            try(parallel::stopCluster(cluster), silent = TRUE)
        }, add = TRUE)
    }

    set.seed(opts$seed)

    emit_progress("matching", 10, "searching for corresponding regions")

    ## match_print_subarea() draws a comparison figure of its own; absorb it into
    ## a null device so it cannot spill into a stray Rplots.pdf next to the
    ## output. We render our own annotated figure afterwards.
    grDevices::pdf(NULL)
    started <- Sys.time()

    ## Resolved before the call: R evaluates arguments lazily, so a fault here
    ## would otherwise surface deep inside the package's own try(), disguised as
    ## an unrelated failure.
    ref_bins <- sample_or_null(opts$ref_sample)
    ref_bins_final <- sample_or_null(opts$ref_sample_final)
    emit_log(sprintf("reference sampling: search %s, refit %s",
                     if (is.null(ref_bins)) "all points" else ref_bins,
                     if (is.null(ref_bins_final)) "all points" else ref_bins_final))

    result <- tryCatch(
        shoeprintr::match_print_subarea(
            input = print_in,
            reference = print_ref,
            input_circles = input_circles,
            max_rotation_angle = opts$max_rotation,
            ncross_ref_bins = ref_bins,
            ncross_ref_bin_size = if (is.null(ref_bins)) NULL else 1L,
            ncross_ref_bins_final = ref_bins_final,
            ncross_ref_bin_size_final = if (is.null(ref_bins_final)) NULL else 1L
        ),
        error = function(e) {
            structure(conditionMessage(e), class = "shoeprint_failure")
        },
        finally = {
            try(grDevices::dev.off(), silent = TRUE)
        }
    )
    duration <- as.numeric(difftime(Sys.time(), started, units = "secs"))

    if (inherits(result, "shoeprint_failure")) {
        stop(sprintf("shoeprintr could not complete the comparison: %s",
                     as.character(result)), call. = FALSE)
    }

    emit_progress("finishing", 92, "summarising results")

    list(
        result = result,
        print_in = print_in,
        print_ref = print_ref,
        input_circles = input_circles,
        cores = cores,
        duration = duration
    )
}

## Result shaping

## match_print_subarea() returns one row per region, but the Comp/Euc_* columns
## describe region *pairs* (1-2, 1-3, 2-3) that merely share the same data
## frame. They are split apart here so the host never conflates the two.
shape_result <- function(run, opts) {
    fm <- run$result

    regions <- lapply(seq_len(nrow(fm)), function(i) {
        list(
            index = i,
            inputCenter = list(x = fm$Input_X[i], y = fm$Input_Y[i]),
            inputRadius = run$input_circles[i, 3],
            referenceCenter = list(x = fm$Reference_X[i], y = fm$Reference_Y[i]),
            referenceRadius = fm$Reference_radius[i],
            cliqueSize = fm$clique_size[i],
            rotationAngle = fm$rotation_angle[i],
            referenceOverlap = fm$reference_overlap[i],
            inputOverlap = fm$input_overlap[i],
            medianSquaredDistance = fm$med_dist_euc[i]
        )
    })

    pairs <- lapply(seq_len(nrow(fm)), function(i) {
        list(
            pair = as.character(fm$Comp[i]),
            inputDistance = fm$Euc_input_dist[i],
            referenceDistance = fm$Euc_ref_dist[i],
            absoluteDifference = abs(fm$Euc_input_dist[i] - fm$Euc_ref_dist[i])
        )
    })

    ## The six similarity features reported in Park & Carriquiry (2020).
    summary <- list(
        meanCliqueSize = mean(fm$clique_size),
        meanInputOverlap = mean(fm$input_overlap),
        meanReferenceOverlap = mean(fm$reference_overlap),
        meanMedianSquaredDistance = mean(fm$med_dist_euc),
        sdRotationAngle = stats::sd(fm$rotation_angle),
        meanAbsoluteTriangleDifference = mean(abs(fm$Euc_input_dist - fm$Euc_ref_dist))
    )

    list(
        schemaVersion = SCHEMA_VERSION,
        status = "ok",
        engine = list(
            library = "shoeprintr",
            libraryVersion = as.character(utils::packageVersion("shoeprintr")),
            rVersion = paste(R.version$major, R.version$minor, sep = "."),
            cores = run$cores
        ),
        parameters = list(
            maxRotationAngle = opts$max_rotation,
            circleRadius = opts$radius,
            seed = opts$seed
        ),
        questioned = c(list(points = nrow(run$print_in)), bbox_of(run$print_in)),
        known = c(list(points = nrow(run$print_ref)), bbox_of(run$print_ref)),
        regions = regions,
        regionPairs = pairs,
        summary = summary,
        durationSeconds = run$duration
    )
}

## Figure

REGION_COLOURS <- c("#d62728", "#ff7f0e", "#2ca02c")

panel_plot <- function(points, centers, radii, title) {
    plot <- ggplot(points, aes(x = x, y = y)) +
        geom_point(colour = "grey45", size = 0.12, alpha = 0.7) +
        coord_fixed() +
        labs(title = title, x = NULL, y = NULL) +
        theme_bw(base_size = 10) +
        theme(
            panel.grid.minor = element_blank(),
            plot.title = element_text(face = "bold", size = 11)
        )

    for (i in seq_along(radii)) {
        inside <- shoeprintr::int_inside_center(
            points, radii[i], 360, centers[i, 1], centers[i, 2]
        )
        if (NROW(inside) > 0) {
            plot <- plot + geom_point(
                data = as.data.frame(inside),
                aes(x = x, y = y), colour = REGION_COLOURS[i], size = 0.16
            )
        }
        plot <- plot +
            shoeprintr::gg_circle(radii[i], xc = centers[i, 1],
                                  yc = centers[i, 2],
                                  color = REGION_COLOURS[i], linewidth = 0.5) +
            annotate("text", x = centers[i, 1], y = centers[i, 2] + radii[i] + 12,
                     label = as.character(i), colour = REGION_COLOURS[i],
                     fontface = "bold", size = 3.6)
    }
    plot
}

render_figure <- function(run, path) {
    fm <- run$result
    questioned <- panel_plot(
        run$print_in,
        run$input_circles[, 1:2, drop = FALSE],
        run$input_circles[, 3],
        "Questioned (Q)"
    )
    known <- panel_plot(
        run$print_ref,
        cbind(fm$Reference_X, fm$Reference_Y),
        fm$Reference_radius,
        "Known (K)"
    )

    grDevices::png(path, width = 1800, height = 1200, res = 180,
                   bg = "white", type = "cairo")
    on.exit(try(grDevices::dev.off(), silent = TRUE), add = TRUE)
    gridExtra::grid.arrange(questioned, known, ncol = 2)
    invisible(path)
}

## Output

write_json <- function(payload, path) {
    json <- jsonlite::toJSON(payload, auto_unbox = TRUE, digits = 8,
                             null = "null", na = "null", pretty = TRUE)
    writeLines(json, path, useBytes = TRUE)
    invisible(path)
}

fail <- function(message, stage, code, output_path) {
    emit_log(sprintf("ERROR (%s): %s", stage, message))
    if (!is.null(output_path)) {
        try(write_json(list(
            schemaVersion = SCHEMA_VERSION,
            status = "error",
            stage = stage,
            message = message
        ), output_path), silent = TRUE)
    }
    quit(status = code, save = "no")
}

## Entry point

main <- function() {
    argv <- commandArgs(trailingOnly = TRUE)

    opts <- tryCatch(parse_args(argv), error = function(e) {
        emit_log(conditionMessage(e))
        quit(status = EXIT_USAGE, save = "no")
    })

    if (opts$version) {
        tryCatch(load_dependencies(), error = function(e) {
            emit_log(conditionMessage(e))
            quit(status = EXIT_DEPENDENCY, save = "no")
        })
        cat(sprintf("shoeprintr %s on R %s.%s\n",
                    as.character(utils::packageVersion("shoeprintr")),
                    R.version$major, R.version$minor))
        quit(status = EXIT_OK, save = "no")
    }

    if (opts$check) {
        tryCatch({
            load_dependencies()
            check_pmc()
        }, error = function(e) {
            emit_log(conditionMessage(e))
            quit(status = EXIT_DEPENDENCY, save = "no")
        })
        cat("OK\n")
        quit(status = EXIT_OK, save = "no")
    }

    if (is.null(opts$input) || is.null(opts$reference) || is.null(opts$output)) {
        emit_log("--input, --reference and --output are all required")
        quit(status = EXIT_USAGE, save = "no")
    }

    tryCatch({
        load_dependencies()
        check_pmc()
    }, error = function(e) {
        fail(conditionMessage(e), "dependencies", EXIT_DEPENDENCY, opts$output)
    })

    run <- tryCatch(run_comparison(opts), error = function(e) {
        fail(conditionMessage(e), "matching", EXIT_MATCHING, opts$output)
    })

    payload <- tryCatch(shape_result(run, opts), error = function(e) {
        fail(conditionMessage(e), "summarising", EXIT_MATCHING, opts$output)
    })

    if (!is.null(opts$plot)) {
        emit_progress("plotting", 96, "rendering comparison figure")
        plotted <- tryCatch({
            render_figure(run, opts$plot)
            TRUE
        }, error = function(e) {
            emit_log(sprintf("figure could not be rendered: %s",
                             conditionMessage(e)))
            FALSE
        })
        payload$plot <- if (plotted) opts$plot else NULL
    }

    tryCatch(write_json(payload, opts$output), error = function(e) {
        fail(conditionMessage(e), "output", EXIT_OUTPUT, NULL)
    })

    emit_progress("done", 100, "comparison complete")
    quit(status = EXIT_OK, save = "no")
}

main()
