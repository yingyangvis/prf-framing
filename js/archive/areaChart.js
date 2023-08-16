// define svg canvas
const margin = {top: 10, right: 40, bottom: 150, left: 60},
	width = window.innerWidth - margin.left - margin.right,
	height = window.innerHeight - margin.top - margin.bottom;

const svg = d3.select("#canvas")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", (height + margin.top + margin.bottom)),
svgGroup = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// load data
const speechData = await d3.json("data/with_jensen_garrett_abbott_climate_climate_change_pms_curie_2_-1.json");
const electionData = await d3.csv("data/federal_elections.csv");
const pmData = await d3.csv("data/prime_minister_terms.csv");

// process data
let speakers = {};
speechData.forEach(d => {
	d.date = d3.timeParse("%Y-%m-%d")(d.date);

	const speaker = d.speaker;
	if (speakers[speaker] === undefined) {
		speakers[speaker] = {
			startDate : d.date,
			endDate : d.date,
			speeches : []
		};
		speakers[speaker].speeches.push(d);
	}
	else {
		speakers[speaker].startDate = speakers[speaker].startDate < d.date ? speakers[speaker].startDate : d.date;
		speakers[speaker].endDate = speakers[speaker].endDate > d.date ? speakers[speaker].endDate : d.date;
		speakers[speaker].speeches.push(d);
	}
});
const sortedSpeakers = Object.entries(speakers).sort(sortSpeakerByDateAscending).map(value => value[0]);
console.log(speakers);

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

// define chart variables
const contextHeight = height / sortedSpeakers.length - 30,
	contextGap = 36;

// define scales
const timeDomain = d3.extent(speechData, d => d.date);
const x = d3.scaleTime()
    .domain([d3.timeYear.floor(timeDomain[0]), d3.timeYear.ceil(timeDomain[1])])
    .range([ 0, width ]);

const y = d3.scaleLinear()
    .domain([ 0, d3.max(speechData, d => +d.diff) ])
    .range([ contextHeight, 0 ]);

// plot pm periods
svgGroup.selectAll("rect")
    .data(pmData)
    .join("g")
	.append("rect")
	.attr("x", d => {return x(d.start_date) > 0 ? x(d.start_date) : 0; })
	.attr("y", d => d.order * (contextHeight + contextGap))
	.attr("width", d => {
		const startX = x(d.start_date) > 0 ? x(d.start_date) : 0;
		const endX = d.end_date < timeDomain[1] ? x(d.end_date) : x(timeDomain[1]);
		return endX - startX; 
	})
  	.attr("height", contextHeight + contextGap)
	.attr("fill", "#ffffb3")
	.attr("opacity", 0.8);

// plot election periods
svgGroup.selectAll("rect")
    .data(electionData)
    .join("g")
	.append("rect")
	.attr("x", d => x(d.issue_of_writ))
	.attr("y", 0)
	.attr("width", d => { return x(d.polling_day) - x(d.issue_of_writ) })
  	.attr("height", Object.keys(speakers).length * (contextHeight + contextGap) + 40)
	.attr("fill", "#E8E8E8");

// plot x-axis
const ticksCount = d3.timeYear.ceil(timeDomain[1]).getFullYear() - d3.timeYear.floor(timeDomain[0]).getFullYear();
svgGroup.append("g")
    .attr("transform", "translate(0," + (Object.keys(speakers).length * (contextHeight + contextGap) + 40) + ")")
    .call(d3.axisBottom(x).ticks(ticksCount));

// plot pm lines to the x-axis
const pmLine = svgGroup.selectAll(".line")
    .data(pmData)
    .join("g");

pmLine
	.append("line")
	.attr("x1", d => x(d.start_date))
	.attr("y1", 0)
	.attr("x2", d => x(d.start_date))
	.attr("y2", Object.keys(speakers).length * (contextHeight + contextGap) + 40)
	.attr("stroke", "black")
	.style("stroke-dasharray", ("6, 6"));

pmLine.append("text")
	.attr("class", "axisLabel")
	.attr("dy", ".35")
	.attr("x", d => {return x(d.start_date) > 0 ? x(d.start_date) + 5 : 0; })
    .attr("y", Object.keys(speakers).length * (contextHeight + contextGap) + 30)
	.text(d => d.name);

// plot area charts
let prevCircle;
sortedSpeakers.forEach((speaker, index) => {

	speakers[speaker].speeches = speakers[speaker].speeches.sort(sortSpeechByDateAscending);

	svgGroup.append("path")
		.datum(speakers[speaker].speeches)
		.attr("fill", "#cce5df")
		.attr("stroke", "#69b3a2")
		.attr("stroke-width", 1.5)
		.attr("d", d3.area()
			.curve(d3.curveMonotoneX)
			.x(d => x(d.date))
			.y0(y(0))
			.y1(d => y(d.diff))
		)
		.attr("transform", "translate(0," + (index * (contextHeight + contextGap)) + ")");

	svgGroup.append("text")
		.attr("class", "label")
		.attr("dy", ".35")
      	.attr("x", 0)
      	.attr("y", index * (contextHeight + contextGap) + 15)
		.text(speaker);

	svgGroup.selectAll(".circle")
		.data(speakers[speaker].speeches)
		.join("g")
		.append("circle")
        .attr("fill", "red")
        .attr("stroke", "none")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.diff))
        .attr("r", 2)
		.attr("transform", "translate(0," + (index * (contextHeight + contextGap)) + ")")
		.on("mouseover", function(event, d) {

			// highlight current circle
			d3.select(prevCircle).attr("class", "");
			prevCircle = this;
			d3.select(this).attr("class", "circle-highlighted");

			// show value lines
			d3.selectAll(".valueLine").remove();
			d3.selectAll(".valueLineLabel").remove();
			sortedSpeakers.forEach((speaker, index) => {
				svgGroup.append("line")
					.attr("class", "valueLine")
					.attr("x1", x(speakers[speaker].startDate))
					.attr("y1", y(d.diff))
					.attr("x2", x(speakers[speaker].endDate))
					.attr("y2", y(d.diff))
					.attr("stroke", "black")
					.attr("stroke-width", 1.5)
					.attr("transform", "translate(0," + (index * (contextHeight + contextGap)) + ")");
			})
			svgGroup.append("text")
				.attr("class", "valueLineLabel")
				.attr("dy", ".35")
				.attr("x", x(d.date))
				.attr("y", index * (contextHeight + contextGap) + 90)
				.attr("text-anchor", "middle")
				.text(d.diff.toFixed(2));
			
			// show tooltip
			d3.select("#tooltip-container")
                .style("display", "block")
				.style("width", window.innerWidth / 4.5)
                .style("left", window.innerWidth - window.innerWidth / 4.5 - 100 + scrollX)
                .style("top", window.innerHeight - 7 * window.innerHeight / 9 + scrollY)
			d3.select("#tooltip-text")
				.html("<b>Speaker:</b> " + d.speaker + "<br/>" + 
					"<b>Date:</b> " + d3.timeFormat("%d %B %Y")(d.date) + "<br/>" + 
					"<b>Diff: </b>" + d.diff.toFixed(2)+ "<br/><br/>" + 
					d.text);
		})
})

svg.on("click", function() {

	d3.select(prevCircle).attr("class", "");
	prevCircle = null;

	d3.selectAll(".valueLine").remove();
	d3.selectAll(".valueLineLabel").remove();

	d3.select("#tooltip-container").style("display", "none");
})

function sortSpeakerByDateAscending(a, b) {
    return a[1].startDate - b[1].startDate;
}

function sortSpeechByDateAscending(a, b) {
    return a.date - b.date;
}