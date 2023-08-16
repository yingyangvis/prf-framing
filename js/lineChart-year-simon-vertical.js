// define svg canvas and vis variables
const width = 600,
margin = {top: 10, right: (window.innerWidth - width) / 2 - 20, bottom: 80, left: (window.innerWidth - width) / 2 - 20},
height = window.innerHeight - margin.top - margin.bottom;

const contentGap = 40,
pmButtonRadius = 30, pmButtonStrokeWidth = 2.5, pmButtonGap = 20, 
pmImageWidth = 52,
pathStrokeWidth = 4,
stopRadius = 4, stopStrokeWidth = 2,
timelineStrokeWidth = 5,
movementArrowStrokeWidth = 1.5;

const svg = d3.select("#canvas")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom - 20),
visGroup = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
buttonGroup = svg.append("g")
    .attr("transform", "translate(" + (margin.left - pmButtonRadius * 2) + "," + (margin.top + pmButtonRadius) + ")"),
arrowGroup = svg.append("g")
    .attr("transform", "translate(" + (margin.left + width / 2) + "," + (margin.top + height) + ")");

let resizeId;
$(window).resize(function() {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => { location.reload(); }, 100);
});

d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.parentNode.appendChild(this);
    });
};

// define user guide
d3.select("#user-guide")
    .style("width", margin.left - pmButtonRadius * 2 - contentGap * 2.5)
    .style("left", contentGap / 2)
    .style("top", () => { return window.innerHeight - d3.select("#user-guide")._groups[0][0].offsetHeight - 30; });

// define colour palette
const metroMapColours = ["#009E73", "#94BDAC", "#DC829C", "#565984", "#018AC8", "#CFDA5A", "#C07B2A", "#FCC73E", "#D41159"];

// load data
const speechData = await d3.json("data/with_jensen_garrett_abbott_climate_climate_change_pms_curie_2_-1.json");
const diffData = await d3.csv("data/with_jensen_garrett_abbott_climate_climate_change_pms_curie_2_-1_summary_table_dynamic.csv");
const electionData = await d3.csv("data/federal_elections.csv");
const pmData = await d3.csv("data/prime_minister_terms.csv");

// process data
let dateIntervals = [...new Set(diffData.map(d => d.record_date))];
dateIntervals = dateIntervals.map(d => d3.timeParse("%d-%b-%Y")(d)).sort(sortByDate);

let speakers = {};
speechData.forEach(d => {
	d.date = d3.timeParse("%Y-%m-%d")(d.date);

    let key;
    dateIntervals.every(bin => {
        if (bin >= d.date)  {
            key = bin;
            return false;
        }
        return true;
    })

	const speaker = d.speaker;
	if (speakers[speaker] === undefined) {
		speakers[speaker] = {
			startDate : d.date,
			endDate : d.date,
			speeches : [],
            groupedSpeeches : {}
		};
		speakers[speaker].speeches.push(d);
        speakers[speaker].groupedSpeeches[key] = {};
        speakers[speaker].groupedSpeeches[key].speeches = [];
        speakers[speaker].groupedSpeeches[key].speeches.push(d);
	}
	else {
		speakers[speaker].startDate = speakers[speaker].startDate < d.date ? speakers[speaker].startDate : d.date;
		speakers[speaker].endDate = speakers[speaker].endDate > d.date ? speakers[speaker].endDate : d.date;
		speakers[speaker].speeches.push(d);
        if (speakers[speaker].groupedSpeeches[key] === undefined) {
            speakers[speaker].groupedSpeeches[key] = {};
            speakers[speaker].groupedSpeeches[key].speeches = [];
            speakers[speaker].groupedSpeeches[key].speeches.push(d);
        }
        else {
            speakers[speaker].groupedSpeeches[key].speeches.push(d);
        }
	}
});
const sortedSpeakers = Object.entries(speakers)
    .sort((a, b) => a[1].startDate - b[1].startDate)
    .map(value => value[0]);
console.log(speakers);

//// define scales here to determine stop overlaps
const maxMean = d3.max(diffData, d => d.mean);
const x = d3.scaleLinear()
    .domain([ -maxMean, maxMean ])
    .range([ 0, width ]);

const timeDomain = d3.extent(speechData, d => d.date);
const y = d3.scaleTime()
    .domain([ d3.timeYear.floor(timeDomain[0]), d3.timeYear.ceil(timeDomain[1]) ])
    .range([ height, 0 ]);

let speakerDiff = {};
let dateDict = {};
diffData.forEach(d => {
    d.record_date = d3.timeParse("%d-%b-%Y")(d.record_date);
    d.mean = Number(d.mean);
    const speaker = d.speaker;

    let key;
    dateIntervals.every(bin => {
        if (bin >= d.record_date)  {
            key = bin;
            return false;
        }
        return true;
    })
    d.bin_date = key;

    if (speakers[speaker].groupedSpeeches[key] !== undefined) {
        const speeches = speakers[speaker].groupedSpeeches[key].speeches;
        const highestDiff = Math.max(...speeches.map(d => d.diff));
        const highestSpeech = speeches.filter(d => d.diff == highestDiff)[0];
        d.highestSpeech = highestSpeech;
        const lowestDiff = Math.min(...speeches.map(d => d.diff));
        const lowestSpeech = speeches.filter(d => d.diff == lowestDiff)[0];
        d.lowestSpeech = lowestSpeech;
    }

    if (speakerDiff[speaker] === undefined) { 
        speakerDiff[speaker] = [];
        speakerDiff[speaker].push(d);
    }
    else {
        speakerDiff[speaker].push(d);
    }

    if (dateDict[key] === undefined) {

        d.x = x(d.mean);

        dateDict[key] = [];
        const obj = {
            value : d.x,
            speaker : speaker
        };
        dateDict[key].push(obj);
        dateDict[key].sort(sortByValueDescending);
    }
    else {
            
         dateDict[key].reverse().forEach(obj => {
            if (Math.abs(x(d.mean) - obj.value) <= stopRadius * 2)
                d.x = obj.value + stopRadius * 2 + 1;
            else
                d.x = x(d.mean);
        })

        const obj = {
            value : d.x,
            speaker : speaker
        };
        dateDict[key].push(obj);
        dateDict[key].sort(sortByValueDescending);
    }
})
console.log(speakerDiff);

electionData.forEach(d => {
	d.issue_of_writ = d3.timeParse("%d-%b-%Y")(d.issue_of_writ);
	d.polling_day = d3.timeParse("%d-%b-%Y")(d.polling_day);
})
console.log(electionData);

const pmNameMatching = {
	Albanese : "Anthony Norman Albanese",
	Howard : "John Winston Howard",
	Rudd : "Kevin Michael Rudd",
	Gillard : "Julia Eileen Gillard",
	Turnbull : "Malcolm Bligh Turnbull",
	Garrett : "Peter Robert Garrett",
	Jensen : "Dennis Geoffrey Jensen",
	Abbott : "Tony John Abbott",
	Morrison : "Scott John Morrison"
}
pmData.forEach(d => {
	d.fullname = pmNameMatching[d.name];
	d.order = sortedSpeakers.indexOf(d.fullname);
	d.start_date = d3.timeParse("%d-%b-%Y")(d.start_date);
	d.end_date = d3.timeParse("%d-%b-%Y")(d.end_date);
})
console.log(pmData);

// plot pm buttons
let isButtonHovered = false;
const pmButton = buttonGroup.selectAll("circle")
    .data(sortedSpeakers)
    .join("g")
    .attr("id", d => d.split(" ")[d.split(" ").length - 1] + "-button")
    .attr("opacity", 1)
    .on("mouseover", function() {
        isButtonHovered = true;
    })
    .on("mouseout", function() {
        isButtonHovered = false;
    })
    .on("click", function(event, d) {
        const surname = d.split(" ")[d.split(" ").length - 1];
        if (this.getAttribute("opacity") == 1) {
            hideAPath(surname);
            cleanPmTooltip(surname);
        }
        else {
            showAPath(surname);
        }
    });
pmButton.append("circle")
    .attr("fill", "white")
    .attr("stroke", d => metroMapColours[sortedSpeakers.indexOf(d)])
    .attr("stroke-width", pmButtonStrokeWidth)
    .attr("cx", 0)
    .attr("cy", (d, i) => i * (pmButtonRadius * 2 + pmButtonGap))
    .attr("r", pmButtonRadius);
pmButton.append("image")
    .attr("x", -pmImageWidth / 2)
    .attr("y", (d, i) => i * (pmButtonRadius * 2 + pmButtonGap) - pmImageWidth / 2)
    .attr("width", pmImageWidth)
    .attr("height", pmImageWidth)
    .attr("xlink:href", d => "images/" + d.split(" ")[d.split(" ").length - 1].toLowerCase() + ".png");
pmButton.append("text")
	.attr("class", "axisLabel")
	.attr("x", 0)
    .attr("y", (d, i) => i * (pmButtonRadius * 2 + pmButtonGap) + pmButtonRadius + 10)
    .attr("text-anchor", "middle")
	.text(d => d.split(" ")[d.split(" ").length - 1]);

// plot pm periods
pmData.forEach((d, index) => {

    const endY = y(d.start_date) < height ? y(d.start_date) : height,
    shadowHeight = 50;

    const gradient = visGroup.append("linearGradient")
        .attr("y1", endY)
        .attr("y2", endY + shadowHeight)
        .attr("x1", "0")
        .attr("x2", "0")
        .attr("id", "gradient" + index)
        .attr("gradientUnits", "userSpaceOnUse");
    gradient
        .append("stop")
        .attr("offset", "0")
        .attr("stop-color", "white");
    gradient
        .append("stop")
        .attr("offset", "1")
        .attr("stop-color", "grey");

    visGroup.append("rect")
        .attr("x", 0)
        .attr("y", endY)
        .attr("width", width)
        .attr("height", shadowHeight)
        .attr("fill", "url(#gradient" + index + ")")
        .attr("opacity", .2)
        .attr("transform", "translate(0," + -shadowHeight + ")");
})

// plot election periods
visGroup.selectAll("rect")
    .data(electionData)
    .join("g")
	.append("rect")
	.attr("x", 0)
	.attr("y", d => y(d.issue_of_writ))
	.attr("width", width)
  	.attr("height", d => { return y(d.issue_of_writ) - y(d.polling_day) })
	.attr("fill", "#2F435A")
    .attr("opacity", .25);

// plot pm text to pm periods
visGroup.selectAll("text")
    .data(pmData)
    .join("g")
    .append("text")
	.attr("class", "axisLabel")
	.attr("x", width - 2)
    .attr("y", d => { return y(d.start_date) < height ? y(d.start_date) - 2 : height - 2; })
	.text(d => d.name)
    .attr("text-anchor", "end");

// plot quantile lines for diff values
const minMean = d3.min(diffData, d => d.mean),
medianMean = d3.median(diffData, d => d.mean),
quantileMeanFirst = d3.quantile(diffData, 0.25, d => d.mean),
quantileMeanThird = d3.quantile(diffData, 0.75, d => d.mean);

const quantileLines = visGroup.append("g")
    .attr("transform", "translate(" + -width / 4 + ",0)");

quantileLines.append("line")
	.attr("x1", x(minMean))
	.attr("y1", height)
	.attr("x2", x(minMean))
	.attr("y2", 0)
	.attr("stroke", "#dfdfdf")
	.style("stroke-dasharray", ("2, 2"));
quantileLines.append("text")
    .attr("class", "axisLabel")
	.attr("x", x(minMean))
    .attr("y", 0)
	.text("Min")
    .attr("text-anchor", "middle");

quantileLines.append("line")
	.attr("x1", x(medianMean))
	.attr("y1", height)
	.attr("x2", x(medianMean))
	.attr("y2", 0)
	.attr("stroke", "#dfdfdf")
	.style("stroke-dasharray", ("2, 2"));
quantileLines.append("text")
    .attr("class", "axisLabel")
	.attr("x", x(medianMean))
    .attr("y", 0)
	.text("Median")
    .attr("text-anchor", "middle");

quantileLines.append("line")
	.attr("x1", x(maxMean))
	.attr("y1", height)
	.attr("x2", x(maxMean))
	.attr("y2", 0)
	.attr("stroke", "#dfdfdf")
	.style("stroke-dasharray", ("2, 2"));
quantileLines.append("text")
    .attr("class", "axisLabel")
	.attr("x", x(maxMean))
    .attr("y", 0)
	.text("Max")
    .attr("text-anchor", "middle");

quantileLines.append("line")
	.attr("x1", x(quantileMeanFirst))
	.attr("y1", height)
	.attr("x2", x(quantileMeanFirst))
	.attr("y2", 0)
	.attr("stroke", "#CCCCCC")
	.style("stroke-dasharray", ("2, 2"));
quantileLines.append("text")
    .attr("class", "axisLabel")
	.attr("x", x(quantileMeanFirst))
    .attr("y", 0)
	.text("Q1")
    .attr("text-anchor", "middle");

quantileLines.append("line")
	.attr("x1", x(quantileMeanThird))
	.attr("y1", height)
	.attr("x2", x(quantileMeanThird))
	.attr("y2", 0)
	.attr("stroke", "#CCCCCC")
	.style("stroke-dasharray", ("2, 2"));
quantileLines.append("text")
    .attr("class", "axisLabel")
	.attr("x", x(quantileMeanThird))
    .attr("y", 0)
	.text("Q3")
    .attr("text-anchor", "middle");
    
// plot timeline
let markerBoxWidth = 4,
markerBoxHeight = 4,
refX = markerBoxWidth / 2,
refY = markerBoxHeight / 2,
arrowPoints = [ [0, 0], [0, 4], [4, 2] ];
visGroup.append("defs")
    .append("marker")
    .attr("id", "timelineArrow")
    .attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
    .attr("refX", refX)
    .attr("refY", refY)
    .attr("markerWidth", markerBoxWidth)
    .attr("markerHeight", markerBoxHeight)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", d3.line()(arrowPoints))
    .attr("fill", "#dfdfdf")
    .attr("stroke", "#dfdfdf")
    .attr("stroke-width", 0.1);

const timelineX = width + (stopRadius * 2 + stopStrokeWidth) * d3.max(Object.values(dateDict).map(d => d.length));
const timeline = visGroup.append("g")
    .attr("transform", "translate(" + timelineX + ",0)");
timeline.append("line")
    .attr("x1", stopRadius + stopStrokeWidth + timelineStrokeWidth / 2)
	.attr("y1", height + stopRadius + stopStrokeWidth)
	.attr("x2", stopRadius + stopStrokeWidth + timelineStrokeWidth / 2)
	.attr("y2", 0)
	.attr("stroke", "#dfdfdf")
    .attr("stroke-width", timelineStrokeWidth)
    .attr("marker-end", "url(#timelineArrow)")
    .attr("fill", "none");

// plot y-axis labels on timeline
const ticksCount = d3.timeYear.ceil(timeDomain[1]).getFullYear() - d3.timeYear.floor(timeDomain[0]).getFullYear();
timeline.append("g")
    .attr("transform", "translate(" + (timelineStrokeWidth + 4) + ",0)")
    .call(d3.axisRight(y).ticks(ticksCount).tickSize(0));
timeline.selectAll(".domain").remove();
timeline.selectAll(".tick").filter((d, i) => i == ticksCount).remove();

// plot circles on timeline
Object.entries(dateDict).forEach(entry => {
    const date = new Date(entry[0]);
    timeline.selectAll(".circle")
        .data(entry[1])
        .join("g")
        .append("circle")
        .attr("class", d => d.speaker.split(" ")[d.speaker.split(" ").length - 1] + "-timeline")
        .attr("fill", d => metroMapColours[sortedSpeakers.indexOf(d.speaker)])
        .attr("stroke", d => metroMapColours[sortedSpeakers.indexOf(d.speaker)])
        .attr("stroke-width", stopStrokeWidth)
        .attr("cx", (d, i) => - i * (stopRadius * 2 + stopStrokeWidth))
        .attr("cy", y(date))
        .attr("r", stopRadius)
        .on("mouseover", function() {
            isButtonHovered = true;
        })
        .on("mouseout", function() {
            isButtonHovered = false;
        })
        .on("click", function(event, d) {
            const surname = d.speaker.split(" ")[d.speaker.split(" ").length - 1];
            if (this.getAttribute("fill") != "white") {
                hideAPath(surname);
                cleanPmTooltip(surname);
            }
            else {
                showAPath(surname);
            }
        })
})

// plot movement arrows
markerBoxWidth = 8,
markerBoxHeight = 8,
refX = markerBoxWidth / 2,
refY = markerBoxHeight / 2,
arrowPoints = [ [0, 0], [0, 8], [8, 4] ];
arrowGroup.append("defs")
    .append("marker")
    .attr("id", "movementArrow")
    .attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
    .attr("refX", refX)
    .attr("refY", refY)
    .attr("markerWidth", markerBoxWidth)
    .attr("markerHeight", markerBoxHeight)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", d3.line()(arrowPoints))
    .attr("fill", "black")
    .attr("stroke", "black")
    .attr("stroke-width", 0.1);

arrowGroup.append("line")
    .attr("x1", -width / 2.5)
	.attr("y1", 20)
	.attr("x2", -width / 8)
	.attr("y2", 20)
    .attr("stroke", "black")
    .attr("stroke-width", movementArrowStrokeWidth)
    .attr("marker-start", "url(#movementArrow)")
    .attr("fill", "none");
arrowGroup.append("text")
	.attr("class", "label")
	.attr("x", -width / 8)
    .attr("y", 40)
	.text("More Climate Science Denialism")
    .attr("text-anchor", "end");

arrowGroup.append("line")
    .attr("x1", width / 8)
	.attr("y1", 20)
	.attr("x2", width / 2.5)
	.attr("y2", 20)
    .attr("stroke", "black")
    .attr("stroke-width", movementArrowStrokeWidth)
    .attr("marker-end", "url(#movementArrow)")
    .attr("fill", "none");
arrowGroup.append("text")
	.attr("class", "label")
	.attr("x", width / 8)
    .attr("y", 40)
	.text("More Climate Science Avocacy")
    .attr("text-anchor", "start");

// plot line chart
let prevStop,
isCircleHovered = false,
isCircleClicked = false;
sortedSpeakers.forEach((speaker, index) => {

	speakerDiff[speaker] = speakerDiff[speaker].sort((a, b) => a.bin_date - b.bin_date);
    const surname = speaker.split(" ")[speaker.split(" ").length - 1];

    const pmPath = visGroup.append("g")
        .datum(speakerDiff[speaker])
        .attr("id", surname + "-path")
        .attr("transform", "translate(" + -width / 4 + ",0)");

    // plot path
    if (speakerDiff[speaker].length > 1)
        pmPath.append("path")
            .attr("fill", "none")
            .attr("stroke", metroMapColours[index])
            .attr("stroke-width", pathStrokeWidth)
            .attr("d", d3.line()
                .curve(d3.curveMonotoneY)
                .x(d => d.x)
                .y(d => y(d.bin_date))
            );
    else
        pmPath.append("line")
            .attr("stroke", metroMapColours[index])
            .attr("stroke-width", pathStrokeWidth)
            .attr("x1", d => d[0].x)
	        .attr("y1", d => y(d[0].bin_date) - 15)
	        .attr("x2", d => d[0].x)
	        .attr("y2", d => y(d[0].bin_date) + 15);

    // plot pm face on path
    const latestSpeech = speakerDiff[speaker][speakerDiff[speaker].length - 1],
    faceX = latestSpeech.mean > maxMean / 2 ? latestSpeech.x + 90 : latestSpeech.x - 90,
    faceY = y(latestSpeech.bin_date) <= pmImageWidth ? pmImageWidth : y(latestSpeech.bin_date) - 6;
    pmPath.append("line")
        .attr("x1", latestSpeech.x)
        .attr("y1", y(latestSpeech.bin_date))
        .attr("x2", latestSpeech.mean > maxMean / 2 ? faceX - 20 : faceX + 20)
        .attr("y2", faceY - 10)
        .attr("stroke", "black")
        .style("stroke-dasharray", ("3,3"));
    pmPath.append("image")
        .attr("x", faceX)
        .attr("y", faceY)
        .attr("width", pmImageWidth)
        .attr("height", pmImageWidth)
        .attr("xlink:href", "images/" + speaker.split(" ")[speaker.split(" ").length - 1].toLowerCase() + ".png")
        .attr("transform", "translate(" + -pmButtonRadius + "," + -pmImageWidth + ")");

    // plot stops on path
    pmPath.selectAll(".circle")
		.data(speakerDiff[speaker])
		.join("g")
		.append("circle")
        .attr("id", surname + "-stop")
        .attr("fill", "white")
        .attr("stroke", "black")
        .attr("stroke-width", stopStrokeWidth)
        .attr("cx", d => d.x)
        .attr("cy", d => y(d.bin_date))
        .attr("r", stopRadius)
        .on("mouseover", function(event, d) {

            isCircleHovered = true;

            cleanTooltip();

            // highlight stop
            d3.select(this)
                .attr("r", stopRadius * 2)
                .attr("class", "circle-highlighted");
            prevStop = this;            

            // show tooltip
            const tooltipWidth = margin.right + width - timelineX - contentGap * 2.5;
			d3.select("#tooltip-container")
                .attr("class", surname + "-tooltip")
                .style("display", "block")
				.style("width", tooltipWidth)
                .style("left", margin.left + timelineX + contentGap * 2)
                .style("top", contentGap * 2)
                .style("max-height", height - contentGap * 2);

            let tooltipText = "<b>Speaker:</b> " + speaker + "<br/>" + 
					"<b>Date:</b> " + d.bin_date.toLocaleDateString("en-au", { year:"numeric", month:"short", day:"numeric"}) + "<br/>" + 
					"<b>Mean Diff: </b>" + d.mean.toFixed(2) + "<br/>" + 
                    "<b>Speech Snippet Count: </b>" + d.GroupCount;
            if (d.highestSpeech !== undefined)
                tooltipText += "<br/><br/>" + "<b>Highest Diff Speech Snippet (" + d.highestSpeech.diff.toFixed(2) + "): </b>" + "<br/>" + 
                    d.highestSpeech.text + "<br/><br/>" + 
                    "<b>Lowest Diff Speech Snippet (" + d.lowestSpeech.diff.toFixed(2) + "): </b>" + "<br/>" + 
                    d.lowestSpeech.text;
			d3.select("#tooltip-text").html( tooltipText );

            // call out of the tooltip
            const tooltip = d3.select("#tooltip-container")._groups[0][0];
            pmPath.append("line")
                .attr("class", "callout")
                .attr("id", surname + "-tooltip")
                .attr("x1", d.x + stopRadius + 1)
                .attr("y1", y(d.bin_date) - (stopRadius + 1))
                .attr("x2", tooltip.offsetLeft - tooltipWidth - pmImageWidth / 2)
                .attr("y2", contentGap * 2)
                .attr("stroke", "black")
                .moveToFront()
                .attr("transform", "translate(-150,0)");
            
            // show pm face on tooltip
            visGroup.append("image")
                .attr("class", "face")
                .attr("id", surname + "-face")
                .attr("x", timelineX + contentGap * 2 - 6)
                .attr("y", contentGap * 2 - pmImageWidth - 20)
                .attr("width", pmImageWidth)
                .attr("height", pmImageWidth)
                .attr("xlink:href", "images/" + speaker.split(" ")[speaker.split(" ").length - 1].toLowerCase() + ".png");
        })
        .on("mouseout", function(event) {
            if (!isCircleClicked) cleanTooltip();
            isCircleHovered = false;
        });
})

// click canvas to dehighlight stop and remove tooltip
svg.on("click", function() {
    if (!isButtonHovered)
        if (!isCircleHovered) {
            cleanTooltip();
            isCircleClicked = false;
        }
        else {
            isCircleClicked = true;
        }
})

// initial vis only shows some pms
Object.keys(pmNameMatching).forEach(surname => {
    if (!["Albanese", "Abbott", "Morrison", "Jensen", "Garrett"].includes(surname)) hideAPath(surname);
})

function showAPath(surname) {
    d3.select("#" + surname + "-button").attr("opacity", 1);
    d3.selectAll("." + surname + "-timeline").attr("fill", metroMapColours[sortedSpeakers.indexOf(pmNameMatching[surname])]);
    d3.selectAll("#" + surname + "-path").style("display", "block");
    d3.selectAll("#" + surname + "-stop").style("display", "block");
}

function hideAPath(surname) {
    d3.select("#" + surname + "-button").attr("opacity", .3);
    d3.selectAll("." + surname + "-timeline").attr("fill", "white");
    d3.selectAll("#" + surname + "-path").style("display", "none");
    d3.selectAll("#" + surname + "-stop").style("display", "none");
}

function cleanTooltip() {
    d3.select(prevStop).attr("class", "").attr("r", stopRadius);
    prevStop = null;
    d3.select("#tooltip-container").style("display", "none");
    d3.select(".callout").remove();
    d3.selectAll(".face").remove();
}

function cleanPmTooltip(surname) {
    d3.selectAll("#" + surname + "-stop").attr("class", "").attr("r", stopRadius);
    d3.selectAll("." + surname + "-tooltip").style("display", "none");
    d3.selectAll("#" + surname + "-tooltip").remove();
    if (d3.selectAll("#" + surname + "-face")._groups[0].length > 0) isCircleClicked = false;
    d3.selectAll("#" + surname + "-face").remove();
}

function sortByValueDescending(a, b) {
    return b.value - a.value;
}

function sortByDate(a, b) {
    return a - b;
}