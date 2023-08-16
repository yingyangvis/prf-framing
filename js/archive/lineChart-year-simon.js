// define svg canvas
const margin = {top: 120, right: 40, bottom: 150, left: 60},
	width = window.innerWidth - margin.left - margin.right,
	height = window.innerHeight - margin.top - margin.bottom,
    contextHeight = height - 50;

const svg = d3.select("#canvas")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", (height + margin.top + margin.bottom)),
visGroup = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
buttonGroup = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top / 2 + ")");

// define colour palette
const metroMapColours = ["#0075bf", "#e6171d", "#008966", "#a525a9", "#f7c55c", "#0e2d63", "#9e6936", "#ffb2b9", "#7fbc4b",];

// load data
const speechData = await d3.json("data/with_jensen_garrett_abbott_climate_climate_change_pms_curie_2_-1.json");
const diffData = await d3.csv("data/with_jensen_garrett_abbott_climate_climate_change_pms_curie_2_-1_summary_table.csv");
const electionData = await d3.csv("data/federal_elections.csv");
const pmData = await d3.csv("data/prime_minister_terms.csv");

// process data
let speakers = {};
speechData.forEach(d => {
	d.date = d3.timeParse("%Y-%m-%d")(d.date);
    const speechYear = d.date.getFullYear();

	const speaker = d.speaker;
	if (speakers[speaker] === undefined) {
		speakers[speaker] = {
			startDate : d.date,
			endDate : d.date,
			speeches : [],
            groupedSpeeches : {}
		};
		speakers[speaker].speeches.push(d);
        speakers[speaker].groupedSpeeches[speechYear] = {};
        speakers[speaker].groupedSpeeches[speechYear].speeches = [];
        speakers[speaker].groupedSpeeches[speechYear].speeches.push(d);
	}
	else {
		speakers[speaker].startDate = speakers[speaker].startDate < d.date ? speakers[speaker].startDate : d.date;
		speakers[speaker].endDate = speakers[speaker].endDate > d.date ? speakers[speaker].endDate : d.date;
		speakers[speaker].speeches.push(d);
        if (speakers[speaker].groupedSpeeches[speechYear] === undefined) {
            speakers[speaker].groupedSpeeches[speechYear] = {};
            speakers[speaker].groupedSpeeches[speechYear].speeches = [];
            speakers[speaker].groupedSpeeches[speechYear].speeches.push(d);
        }
        else {
            speakers[speaker].groupedSpeeches[speechYear].speeches.push(d);
        }
	}
});
const sortedSpeakers = Object.entries(speakers).sort(sortSpeakerByDateAscending).map(value => value[0]);
sortedSpeakers.forEach(speaker => {
    speakers[speaker].groupedSpeeches = Object.values(speakers[speaker].groupedSpeeches);
    speakers[speaker].groupedSpeeches.forEach(value => {
        const diffs = Object.entries(value.speeches).map(el => el[1].diff);
        value.meanDiff = diffs.reduce((a,b) => a + b) / diffs.length;
        value.year = new Date(value.speeches[0].date.getFullYear(), 0);
    })
})
console.log(speakers);

let speakerDiff = {};
diffData.forEach(d => {
    const speaker = d.speaker;
    d.date = new Date(d.year, 0);
    d.mean = Number(d.mean);
	if (speakerDiff[speaker] === undefined) { 
        speakerDiff[speaker] = [];
        speakerDiff[speaker].push(d);
    }
    else {
        speakerDiff[speaker].push(d);
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
const pmButton = buttonGroup.selectAll("circle")
    .data(sortedSpeakers)
    .join("g");

pmButton.append("circle")
    .attr("fill", "white")
    .attr("stroke", d => metroMapColours[sortedSpeakers.indexOf(d)])
    .attr("stroke-width", 2.5)
    .attr("cx", (d, i) => i * (30 * 2 + 20))
    .attr("cy", 0)
    .attr("r", 30)
	.attr("transform", "translate(30,0)");

pmButton.append("text")
	.attr("class", "axisLabel")
	.attr("x", (d, i) => i * (30 * 2 + 20) + 30)
    .attr("y", 0)
    .attr("text-anchor", "middle")
	.text(d => d.split(" ")[d.split(" ").length - 1]);

pmButton.append("image")
    .attr('x', (d, i) => i * (30 * 2 + 20) + 4)
    .attr('y', -26)
    .attr('width', 52)
    .attr('height', 52)
    .attr("xlink:href", d => "images/" + d.split(" ")[d.split(" ").length - 1] + ".png")

// define scales
const timeDomain = d3.extent(speechData, d => d.date);
const x = d3.scaleTime()
    .domain([d3.timeYear.floor(timeDomain[0]), d3.timeYear.ceil(timeDomain[1])])
    .range([ 0, width ]);

const y = d3.scaleLinear()
    .domain([ 0, d3.max(diffData, d => +d.mean) ])
    .range([ contextHeight - 200, 0 ]);

// plot pm periods
pmData.forEach((d, index) => {

    const startX = x(d.start_date) > 0 ? x(d.start_date) : 0;
    const endX = d.end_date < timeDomain[1] ? x(d.end_date) : x(timeDomain[1]);

    const gradient = visGroup.append("linearGradient")
        .attr("y1", "0")
        .attr("y2", "0")
        .attr("x1", startX + 80)
        .attr("x2", startX)
        .attr("id", "gradient" + index)
        .attr("gradientUnits", "userSpaceOnUse");
    gradient
        .append("stop")
        .attr("offset", "0")
        .attr("stop-color", "white");
    gradient
        .append("stop")
        .attr("offset", "1")
        .attr("stop-color", "grey"); //metroMapColours[sortedSpeakers.indexOf(d.fullname)]);

    visGroup.append("rect")
        .attr("x", x(d.start_date) > 0 ? x(d.start_date) : 0)
        .attr("y", 0)
        .attr("width", endX - startX)
        .attr("height", height + 40)
        .attr("fill", "url(#gradient" + index + ")")
        .attr("opacity", .2);
})

// plot timeline
const markerBoxWidth = 4,
markerBoxHeight = 4,
refX = markerBoxWidth / 2,
refY = markerBoxHeight / 2,
markerWidth = markerBoxWidth / 2,
markerHeight = markerBoxHeight / 2,
arrowPoints = [[0, 0], [0, 4], [4, 2]];

visGroup.append("defs")
  .append("marker")
  .attr("id", "arrow")
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

visGroup.append("line")
    .attr("x1", 0)
	.attr("y1", height + 70)
	.attr("x2", width - 30)
	.attr("y2", height + 70)
	.attr("stroke", "#dfdfdf")
    .attr("stroke-width", 5)
    .attr("marker-end", "url(#arrow)")
    .attr("fill", "none");

visGroup.append("circle")
    .attr("cx", 0)
    .attr("cy", height + 70)
    .attr("r", 8)
    .attr("fill", "#dfdfdf");

// plot x-axis
const ticksCount = d3.timeYear.ceil(timeDomain[1]).getFullYear() - d3.timeYear.floor(timeDomain[0]).getFullYear();
visGroup.append("g")
    .attr("transform", "translate(0," + (height + 60) + ")")
    .call(d3.axisBottom(x).ticks(ticksCount).tickSize(0));
visGroup.selectAll(".domain").remove();
visGroup.selectAll(".tick").filter((d, i) => i == 0 || i == ticksCount).remove();

// plot pm lines to the x-axis
const pmLine = visGroup.selectAll(".line")
    .data(pmData)
    .join("g");

pmLine.append("text")
	.attr("class", "axisLabel")
	.attr("dy", ".35")
	.attr("x", d => {return x(d.start_date) > 0 ? x(d.start_date) + 5 : 5; })
    .attr("y", height + 30)
	.text(d => d.name);

// plot line chart
let prevCircle;
sortedSpeakers.forEach((speaker, index) => {

	speakerDiff[speaker] = speakerDiff[speaker].sort(sortSpeechByDateAscending);

    if (speakerDiff[speaker].length > 1)
        visGroup.append("path")
            .datum(speakerDiff[speaker])
            .attr("fill", "none")
            .attr("stroke", metroMapColours[index])
            .attr("stroke-width", 4)
            .attr("d", d3.line()
                .curve(d3.curveMonotoneX)
                .x(d => x(d.date))
                .y(d => y(d.mean))
            )
            .attr("transform", "translate(0," + (contextHeight / 2 - 150) + ")");
    else
        visGroup.append("line")
            .datum(speakerDiff[speaker])
            .attr("stroke", metroMapColours[index])
            .attr("stroke-width", 4)
            .attr("x1", d => x(d[0].date) - 20)
	        .attr("y1", d => y(d[0].mean))
	        .attr("x2", d => x(d[0].date) + 20)
	        .attr("y2", d => y(d[0].mean))
            .attr("transform", "translate(0," + (contextHeight / 2 - 150) + ")");

    visGroup.selectAll(".circle")
		.data(speakerDiff[speaker])
		.join("g")
		.append("circle")
        .attr("fill", "white")
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.mean))
        .attr("r", 4)
		.attr("transform", "translate(0," + (contextHeight / 2 - 150) + ")")
		.on("mouseover", function(event, d) {

			// highlight current circle
			d3.select(prevCircle).attr("class", "");
			prevCircle = this;
			d3.select(this).attr("class", "circle-highlighted");
			
			// show tooltip
			d3.select("#tooltip-container")
                .style("display", "block")
				.style("width", window.innerWidth / 4.5)
                .style("left", window.innerWidth - window.innerWidth / 4.5 - 100 + scrollX)
                .style("top", window.innerHeight - 7 * window.innerHeight / 9 + scrollY)
			d3.select("#tooltip-text")
				.html("<b>Speaker:</b> " + speaker + "<br/>" + 
					"<b>Year:</b> " + d.year + "<br/>" + 
					"<b>Diff: </b>" + d.mean.toFixed(2)
                );
		})
})

svg.on("click", function() {

	d3.select(prevCircle).attr("class", "");
	prevCircle = null;

	d3.select("#tooltip-container").style("display", "none");
})

function sortSpeakerByDateAscending(a, b) {
    return a[1].startDate - b[1].startDate;
}

function sortSpeechByDateAscending(a, b) {
    return a.date - b.date;
}
