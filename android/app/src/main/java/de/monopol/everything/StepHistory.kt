package de.monopol.everything

import java.time.LocalDate
import java.time.DayOfWeek
import java.time.temporal.TemporalAdjusters
import java.time.temporal.ChronoUnit

enum class StepPeriod { DAILY, WEEKLY, MONTHLY }
data class StepSample(val day: LocalDate, val steps: Long?)
data class StepBucket(val start: LocalDate, val end: LocalDate, val steps: Long?, val recorded: Int, val expected: Int)

fun aggregateSteps(samples: List<StepSample>, period: StepPeriod, today: LocalDate): List<StepBucket> {
    val count = when(period) { StepPeriod.DAILY -> 14; StepPeriod.WEEKLY -> 8; StepPeriod.MONTHLY -> 12 }
    val unique = samples.associateBy { it.day }.values
    return (0 until count).map { index ->
        val offset = (count - 1 - index).toLong()
        val start = when(period) {
            StepPeriod.DAILY -> today.minusDays(offset)
            StepPeriod.WEEKLY -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(offset)
            StepPeriod.MONTHLY -> today.withDayOfMonth(1).minusMonths(offset)
        }
        val end = minOf(today, when(period) { StepPeriod.DAILY -> start; StepPeriod.WEEKLY -> start.plusDays(6); StepPeriod.MONTHLY -> start.with(TemporalAdjusters.lastDayOfMonth()) })
        val values = unique.filter { it.day >= start && it.day <= end && it.steps != null && it.steps >= 0 }
        StepBucket(start, end, if(values.isEmpty()) null else values.sumOf { it.steps!! }, values.size, ChronoUnit.DAYS.between(start,end).toInt()+1)
    }
}
